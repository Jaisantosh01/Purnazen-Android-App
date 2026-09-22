package com.purnazen.vitals

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

/** Registers the `roiMeans` frame-processor plugin; exposes no JS modules. */
class VitalsPackage : ReactPackage {
  init {
    FrameProcessorPluginRegistry.addFrameProcessorPlugin("roiMeans") { proxy, options ->
      RoiMeansPlugin(proxy, options)
    }
  }

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
