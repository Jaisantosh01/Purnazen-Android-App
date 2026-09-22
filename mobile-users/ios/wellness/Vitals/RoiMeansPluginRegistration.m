#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import "wellness-Swift.h"

// Registers the Swift plugin above under the name the JS side asks for
// (VisionCameraProxy.initFrameProcessorPlugin('roiMeans')).
VISION_EXPORT_SWIFT_FRAME_PROCESSOR(RoiMeansPlugin, roiMeans)
