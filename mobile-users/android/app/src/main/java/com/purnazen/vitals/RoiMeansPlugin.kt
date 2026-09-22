package com.purnazen.vitals

import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

/**
 * VisionCamera frame-processor plugin for the vitals (rPPG) scan.
 *
 * Reduces each camera frame to the mean colour of a centred square ROI and
 * returns { t, r, g, b, n } — the only thing the pulse estimator needs. The
 * frame itself never leaves the device. Averaging is done in YUV on the planes
 * the camera already produces and converted once (BT.601), which is both cheaper
 * and mathematically equivalent to converting every pixel first.
 *
 * Why a centred square and not forehead/cheeks: the capture UI holds the face in
 * a centred oval, and a centred square is invariant to the sensor's rotation and
 * mirroring — the two things that are easiest to get wrong without a device in
 * hand. The square lands on nose + cheeks, a solid rPPG region. Landmark-driven
 * ROIs are a later refinement once validation says they're needed.
 *
 * Params: { size?: number }  side of the square as a fraction of min(w, h),
 *         default 0.35.
 */
class RoiMeansPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {

  override fun callback(frame: Frame, params: Map<String, Any>?): Any {
    val image = frame.image
    val w = image.width
    val h = image.height
    val frac = ((params?.get("size") as? Number)?.toDouble() ?: 0.35).coerceIn(0.05, 1.0)
    val side = (minOf(w, h) * frac).toInt().coerceAtLeast(2)
    val x0 = (w - side) / 2
    val y0 = (h - side) / 2

    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val yBuf = yPlane.buffer
    val uBuf = uPlane.buffer
    val vBuf = vPlane.buffer

    // Luma: full resolution, but every other row/col is plenty for a mean.
    var sumY = 0L
    var nY = 0L
    var row = y0
    while (row < y0 + side) {
      val base = row * yPlane.rowStride + x0 * yPlane.pixelStride
      var col = 0
      while (col < side) {
        sumY += (yBuf.get(base + col * yPlane.pixelStride).toInt() and 0xFF)
        nY++
        col += 2
      }
      row += 2
    }

    // Chroma: 4:2:0, so half resolution in both axes.
    var sumU = 0L
    var sumV = 0L
    var nC = 0L
    var crow = y0 / 2
    val cx0 = x0 / 2
    val cside = side / 2
    while (crow < y0 / 2 + cside) {
      val ub = crow * uPlane.rowStride + cx0 * uPlane.pixelStride
      val vb = crow * vPlane.rowStride + cx0 * vPlane.pixelStride
      var col = 0
      while (col < cside) {
        sumU += (uBuf.get(ub + col * uPlane.pixelStride).toInt() and 0xFF)
        sumV += (vBuf.get(vb + col * vPlane.pixelStride).toInt() and 0xFF)
        nC++
        col += 2
      }
      crow += 2
    }

    val yMean = sumY.toDouble() / nY
    val uMean = sumU.toDouble() / nC - 128.0
    val vMean = sumV.toDouble() / nC - 128.0

    // BT.601 limited-range YUV → RGB (what Android camera YUV_420_888 carries).
    val yy = 1.164 * (yMean - 16.0)
    val r = yy + 1.596 * vMean
    val g = yy - 0.392 * uMean - 0.813 * vMean
    val b = yy + 2.017 * uMean

    return hashMapOf(
      "t" to frame.timestamp / 1e9,        // sensor nanoseconds → seconds
      "r" to r, "g" to g, "b" to b,
      "n" to nY,
    )
  }
}
