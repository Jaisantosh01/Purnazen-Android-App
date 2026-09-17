package com.purnazen.admin.inappupdate

import android.app.Activity
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Google Play In-App Updates (immediate flow).
 *
 * When the backend says a newer version is published, tapping "Update" asks
 * Play to download and install it without leaving the app. This is Play's own
 * update mechanism, so it is exactly what the Device and Network Abuse policy
 * allows — the app never touches an APK itself.
 *
 * Only works for installs that came from Google Play (including internal and
 * closed testing tracks). Anything else — a debug build, a sideloaded QA APK,
 * Firebase App Distribution — reports "not_from_play", and the JS side falls
 * back to opening the store / distribution link.
 *
 * Every method resolves (never rejects) with a status string, so a Play
 * Services problem can never surface as an unhandled promise in the app.
 */
class InAppUpdateModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private val manager: AppUpdateManager by lazy {
    AppUpdateManagerFactory.create(reactApplicationContext)
  }

  /** Resolves { status, availableVersionCode, immediateAllowed, stalenessDays }. */
  @ReactMethod
  fun check(promise: Promise) {
    if (!installedFromPlay()) {
      promise.resolve(result(STATUS_NOT_FROM_PLAY))
      return
    }
    manager.appUpdateInfo
      .addOnSuccessListener { info -> promise.resolve(describe(info)) }
      .addOnFailureListener { promise.resolve(result(STATUS_ERROR)) }
  }

  /**
   * Start Play's full-screen update. Resolves "started" | "cancelled" |
   * "failed" | "unavailable" | "not_from_play" | "no_activity" | "error".
   */
  @ReactMethod
  fun startImmediate(promise: Promise) = start(promise, onlyIfInProgress = false)

  /**
   * Play requires an immediate update that was interrupted (app backgrounded,
   * process killed) to be resumed when the app returns. Call on launch and on
   * every return to the foreground; a no-op when nothing is in progress.
   */
  @ReactMethod
  fun resumeIfInProgress(promise: Promise) = start(promise, onlyIfInProgress = true)

  private fun start(promise: Promise, onlyIfInProgress: Boolean) {
    if (!installedFromPlay()) {
      promise.resolve(STATUS_NOT_FROM_PLAY)
      return
    }
    val activity: Activity = reactApplicationContext.currentActivity ?: run {
      promise.resolve(STATUS_NO_ACTIVITY)
      return
    }
    manager.appUpdateInfo
      .addOnSuccessListener { info ->
        val availability = info.updateAvailability()
        val inProgress =
          availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
        val startable = inProgress || (!onlyIfInProgress &&
          availability == UpdateAvailability.UPDATE_AVAILABLE &&
          info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
        if (!startable) {
          promise.resolve(STATUS_UNAVAILABLE)
          return@addOnSuccessListener
        }
        manager
          .startUpdateFlow(info, activity, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE))
          .addOnSuccessListener { code ->
            promise.resolve(
              when (code) {
                Activity.RESULT_OK -> STATUS_STARTED
                Activity.RESULT_CANCELED -> STATUS_CANCELLED
                else -> STATUS_FAILED
              }
            )
          }
          .addOnFailureListener { promise.resolve(STATUS_FAILED) }
      }
      .addOnFailureListener { promise.resolve(STATUS_ERROR) }
  }

  private fun describe(info: AppUpdateInfo): WritableMap {
    val status = when (info.updateAvailability()) {
      UpdateAvailability.UPDATE_AVAILABLE -> "available"
      UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "in_progress"
      UpdateAvailability.UPDATE_NOT_AVAILABLE -> "up_to_date"
      else -> "unknown"
    }
    return result(status).apply {
      putInt("availableVersionCode", info.availableVersionCode())
      putBoolean("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
      info.clientVersionStalenessDays()?.let { putInt("stalenessDays", it) }
    }
  }

  private fun result(status: String): WritableMap =
    Arguments.createMap().apply { putString("status", status) }

  private fun installedFromPlay(): Boolean {
    val pm = reactApplicationContext.packageManager
    val pkg = reactApplicationContext.packageName
    val installer = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        pm.getInstallSourceInfo(pkg).installingPackageName
      } else {
        @Suppress("DEPRECATION")
        pm.getInstallerPackageName(pkg)
      }
    } catch (e: Exception) {
      null
    }
    return installer == PLAY_STORE_PACKAGE
  }

  companion object {
    const val NAME = "InAppUpdate"
    private const val PLAY_STORE_PACKAGE = "com.android.vending"
    private const val STATUS_STARTED = "started"
    private const val STATUS_CANCELLED = "cancelled"
    private const val STATUS_FAILED = "failed"
    private const val STATUS_UNAVAILABLE = "unavailable"
    private const val STATUS_NOT_FROM_PLAY = "not_from_play"
    private const val STATUS_NO_ACTIVITY = "no_activity"
    private const val STATUS_ERROR = "error"
  }
}
