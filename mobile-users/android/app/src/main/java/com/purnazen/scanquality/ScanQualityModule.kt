package com.purnazen.scanquality

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.Executors
import kotlin.math.cbrt
import kotlin.math.hypot

/**
 * On-device capture-quality analysis for the face/tongue scan screens.
 *
 * Replaces the per-frame network round-trip to `/face-glow/scan/quality-preview`:
 * the same signals the backend gate (`app/ai/quality.py`) computes are produced
 * locally — ML Kit face detection (bundled model, fully offline) plus mean
 * CIE L* lightness and Laplacian-variance sharpness. The frame never leaves the
 * device, and results come back in tens of milliseconds instead of seconds.
 *
 * Parity notes (keep in sync with backend/app/ai/quality.py):
 *  - The backend assesses at width <= 800 (`resize_for_analysis`); we downscale
 *    to the same width so the Laplacian-variance blur threshold is comparable.
 *  - `meanL` is the mean CIE L* channel scaled to 0..255, exactly like OpenCV's
 *    `cvtColor(BGR2Lab)` L channel that the server thresholds against.
 *  - Blur uses the 4-neighbour Laplacian kernel (OpenCV ksize=1 default).
 */
class ScanQualityModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private val executor = Executors.newSingleThreadExecutor()

  private val detector by lazy {
    FaceDetection.getClient(
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
        // Matches the backend Haar gate's min face side of ~10% of the image.
        .setMinFaceSize(0.1f)
        .build()
    )
  }

  @ReactMethod
  fun analyze(path: String, promise: Promise) {
    executor.execute {
      val bmp: Bitmap
      try {
        bmp = decodeForAnalysis(path.removePrefix("file://"))
          ?: run {
            promise.reject("E_DECODE", "Could not decode image: $path")
            return@execute
          }
      } catch (e: Exception) {
        promise.reject("E_DECODE", e)
        return@execute
      }

      val stats = try {
        computeImageStats(bmp)
      } catch (e: Exception) {
        bmp.recycle()
        promise.reject("E_STATS", e)
        return@execute
      }

      val width = bmp.width
      val height = bmp.height
      detector.process(InputImage.fromBitmap(bmp, 0))
        .addOnSuccessListener { faces ->
          val map = Arguments.createMap()
          map.putInt("faceCount", faces.size)
          map.putDouble("meanL", stats.meanL)
          map.putDouble("blurVar", stats.blurVar)

          val largest = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
          if (largest != null) {
            val box = largest.boundingBox
            val area = box.width().toDouble() * box.height().toDouble()
            val cx = box.exactCenterX().toDouble()
            val cy = box.exactCenterY().toDouble()
            map.putDouble("faceAreaRatio", area / (width.toDouble() * height.toDouble()))
            map.putDouble(
              "centerOffset",
              hypot((cx - width / 2.0) / width, (cy - height / 2.0) / height)
            )
            map.putDouble("yaw", largest.headEulerAngleY.toDouble())
            map.putDouble("roll", largest.headEulerAngleZ.toDouble())
          } else {
            map.putDouble("faceAreaRatio", 0.0)
            map.putDouble("centerOffset", 0.0)
            map.putDouble("yaw", 0.0)
            map.putDouble("roll", 0.0)
          }
          bmp.recycle()
          promise.resolve(map)
        }
        .addOnFailureListener { e ->
          bmp.recycle()
          promise.reject("E_FACE_DETECT", e)
        }
    }
  }

  override fun invalidate() {
    super.invalidate()
    try {
      detector.close()
    } catch (_: Exception) {
    }
    executor.shutdown()
  }

  /** Decode subsampled, apply EXIF rotation, then scale to width <= ANALYSIS_WIDTH. */
  private fun decodeForAnalysis(filePath: String): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(filePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    // Subsample to within [ANALYSIS_WIDTH, 2*ANALYSIS_WIDTH) before the exact resize.
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= ANALYSIS_WIDTH) sample *= 2

    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    var bmp = BitmapFactory.decodeFile(filePath, opts) ?: return null

    val rotation = when (
      ExifInterface(filePath).getAttributeInt(
        ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
      )
    ) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (rotation != 0f) {
      val m = Matrix().apply { postRotate(rotation) }
      val rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
      if (rotated !== bmp) bmp.recycle()
      bmp = rotated
    }

    if (bmp.width > ANALYSIS_WIDTH) {
      val scale = ANALYSIS_WIDTH.toFloat() / bmp.width
      val scaled = Bitmap.createScaledBitmap(
        bmp, ANALYSIS_WIDTH, (bmp.height * scale).toInt().coerceAtLeast(1), true
      )
      if (scaled !== bmp) bmp.recycle()
      bmp = scaled
    }
    return bmp
  }

  private class ImageStats(val meanL: Double, val blurVar: Double)

  private fun computeImageStats(bmp: Bitmap): ImageStats {
    val w = bmp.width
    val h = bmp.height
    val pixels = IntArray(w * h)
    bmp.getPixels(pixels, 0, w, 0, 0, w, h)

    // sRGB -> linear lookup table (gamma expansion), used for CIE L*.
    val toLinear = DoubleArray(256) { i ->
      val c = i / 255.0
      if (c <= 0.04045) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
    }

    val gray = FloatArray(w * h)
    var sumL = 0.0
    for (i in pixels.indices) {
      val p = pixels[i]
      val r = (p shr 16) and 0xFF
      val g = (p shr 8) and 0xFF
      val b = p and 0xFF

      // OpenCV BGR2GRAY weights (ITU-R BT.601).
      gray[i] = (0.299f * r + 0.587f * g + 0.114f * b)

      // CIE L* under D65, scaled to 0..255 like OpenCV's Lab L channel.
      val y = 0.212671 * toLinear[r] + 0.715160 * toLinear[g] + 0.072169 * toLinear[b]
      val lStar = if (y > 0.008856) 116.0 * cbrt(y) - 16.0 else 903.3 * y
      sumL += lStar * 255.0 / 100.0
    }

    // Variance of the 4-neighbour Laplacian over interior pixels.
    var sum = 0.0
    var sumSq = 0.0
    var n = 0
    for (yPos in 1 until h - 1) {
      val row = yPos * w
      for (xPos in 1 until w - 1) {
        val i = row + xPos
        val lap = (gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4f * gray[i]).toDouble()
        sum += lap
        sumSq += lap * lap
        n++
      }
    }
    val blurVar = if (n > 0) (sumSq / n) - (sum / n) * (sum / n) else 0.0

    return ImageStats(meanL = sumL / pixels.size, blurVar = blurVar)
  }

  companion object {
    const val NAME = "ScanQuality"
    private const val ANALYSIS_WIDTH = 800 // = backend resize_for_analysis max_width
  }
}
