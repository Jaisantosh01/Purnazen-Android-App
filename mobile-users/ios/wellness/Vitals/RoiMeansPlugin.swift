import Foundation
import VisionCamera
import CoreMedia
import CoreVideo

/// VisionCamera frame-processor plugin for the vitals (rPPG) scan — iOS twin of
/// android/.../vitals/RoiMeansPlugin.kt. Reduces each frame to the mean colour
/// of a centred square ROI and returns { t, r, g, b, n }. The frame never
/// leaves the device. See the Kotlin file for why the ROI is a centred square.
///
/// Expects the camera's default `yuv` pixel format (420YpCbCr8BiPlanar, video
/// or full range). Params: { size?: Double } side as a fraction of min(w, h).
@objc(RoiMeansPlugin)
public class RoiMeansPlugin: FrameProcessorPlugin {

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else { return nil }
    let format = CVPixelBufferGetPixelFormatType(pixelBuffer)
    guard format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
       || format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange else {
      return ["error": "unsupported pixel format \(format); use pixelFormat=\"yuv\""]
    }
    let fullRange = format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange

    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    let w = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
    let h = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
    let frac = min(max((arguments?["size"] as? Double) ?? 0.35, 0.05), 1.0)
    let side = max(2, Int(Double(min(w, h)) * frac))
    let x0 = (w - side) / 2
    let y0 = (h - side) / 2

    guard let yBase = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0),
          let cBase = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 1) else { return nil }
    let yStride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
    let cStride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 1)
    let yPtr = yBase.assumingMemoryBound(to: UInt8.self)
    let cPtr = cBase.assumingMemoryBound(to: UInt8.self)

    // Luma over the square, every other row/col (plenty for a mean).
    var sumY = 0, nY = 0
    var row = y0
    while row < y0 + side {
      let base = row * yStride
      var col = x0
      while col < x0 + side { sumY += Int(yPtr[base + col]); nY += 1; col += 2 }
      row += 2
    }
    // Interleaved CbCr at half resolution.
    var sumU = 0, sumV = 0, nC = 0
    var crow = y0 / 2
    let cx0 = x0 / 2, cside = side / 2
    while crow < y0 / 2 + cside {
      let base = crow * cStride
      var col = cx0
      while col < cx0 + cside {
        sumU += Int(cPtr[base + col * 2])
        sumV += Int(cPtr[base + col * 2 + 1])
        nC += 1
        col += 2
      }
      crow += 2
    }

    let yMean = Double(sumY) / Double(max(nY, 1))
    let uMean = Double(sumU) / Double(max(nC, 1)) - 128.0
    let vMean = Double(sumV) / Double(max(nC, 1)) - 128.0

    // BT.601. Full range: Y' = Y; video range: Y' = 1.164 (Y − 16).
    let yy = fullRange ? yMean : 1.164 * (yMean - 16.0)
    let r = yy + 1.596 * vMean
    let g = yy - 0.392 * uMean - 0.813 * vMean
    let b = yy + 2.017 * uMean

    return ["t": frame.timestamp, "r": r, "g": g, "b": b, "n": nY]
  }
}
