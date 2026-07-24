package com.purnazen.otaupdater

import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * In-app OTA download + install for the sideloaded APK.
 *
 * Replaces the old "open the SAS URL in the browser" hand-off with a real
 * background download and a direct install intent:
 *  - [download] enqueues the APK on Android's {@link DownloadManager}, which keeps
 *    downloading (with its own system progress notification) even if the app is
 *    backgrounded. We poll it and emit `otaDownloadProgress` for an in-app bar,
 *    optionally verify the sha256, then emit `otaDownloadComplete` and post an
 *    "Update ready to install" notification whose tap fires the installer.
 *  - [install] launches the package-installer via a {@link FileProvider} content
 *    URI (ACTION_VIEW). The OS installer handles the replace/"reboot to update".
 *  - [isInstallAllowed] / [openInstallSettings] gate on the sensitive
 *    REQUEST_INSTALL_PACKAGES consent (Android 8+ "install unknown apps").
 *
 * Package-name-stable: the FileProvider authority is derived from the running
 * package at runtime, so the identical file compiles in mobile-users/doctors/admin.
 */
class OtaUpdaterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private val mainHandler = Handler(Looper.getMainLooper())
  private var downloadId: Long = -1L
  private var expectedSha: String? = null
  private var downloadedFile: File? = null
  private var completeReceiver: BroadcastReceiver? = null
  private var pollRunnable: Runnable? = null
  private var finished = false

  private fun manager(): DownloadManager? =
    reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager

  private fun emit(event: String, payload: WritableMap?) {
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, payload)
    } catch (_: Exception) {
      // React instance gone (app tearing down) — nothing to notify.
    }
  }

  // ── Install permission (REQUEST_INSTALL_PACKAGES / "unknown apps") ──────────
  @ReactMethod
  fun isInstallAllowed(promise: Promise) {
    promise.resolve(canRequestInstalls())
  }

  private fun canRequestInstalls(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      reactContext.packageManager.canRequestPackageInstalls()
    else true // pre-O uses the global "Unknown sources" toggle; can't query per-app

  @ReactMethod
  fun openInstallSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${reactContext.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        (reactContext.currentActivity ?: reactContext).startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_SETTINGS", e.message, e)
    }
  }

  // ── Download ────────────────────────────────────────────────────────────────
  @ReactMethod
  fun download(url: String, version: String, sha256: String?, promise: Promise) {
    val dm = manager() ?: run {
      promise.reject("E_NO_DM", "DownloadManager unavailable")
      return
    }
    if (url.isBlank()) {
      promise.reject("E_BAD_URL", "Empty download URL")
      return
    }
    try {
      cleanup() // tear down any previous download bookkeeping
      expectedSha = sha256?.lowercase()?.takeIf { it.length == 64 }

      val fileName = "purnazen-update-$version.apk"
      // App-specific external files dir: no storage permission needed, and the
      // FileProvider can hand it to the installer.
      val target = File(
        reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
        fileName,
      )
      if (target.exists()) target.delete()
      downloadedFile = target

      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle("Purnazen update $version")
        .setDescription("Downloading update…")
        .setMimeType(APK_MIME)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setDestinationInExternalFilesDir(
          reactContext, Environment.DIRECTORY_DOWNLOADS, fileName,
        )
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(true)

      registerCompleteReceiver()
      downloadId = dm.enqueue(request)
      startProgressPolling()
      promise.resolve(downloadId.toString())
    } catch (e: Exception) {
      promise.reject("E_ENQUEUE", e.message, e)
    }
  }

  private fun registerCompleteReceiver() {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
        if (id == downloadId) onDownloadTerminal()
      }
    }
    completeReceiver = receiver
    ContextCompat.registerReceiver(
      reactContext,
      receiver,
      IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
      ContextCompat.RECEIVER_EXPORTED,
    )
  }

  private fun startProgressPolling() {
    val runnable = object : Runnable {
      override fun run() {
        if (finished) return
        val dm = manager() ?: return
        dm.query(DownloadManager.Query().setFilterById(downloadId))?.use { c ->
          if (!c.moveToFirst()) return@use
          val status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
          if (status == DownloadManager.STATUS_RUNNING ||
            status == DownloadManager.STATUS_PENDING ||
            status == DownloadManager.STATUS_PAUSED
          ) {
            val soFar = c.getLong(
              c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
            )
            val total = c.getLong(
              c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
            )
            val pct = if (total > 0) ((soFar * 100) / total).toInt() else -1
            emit(
              EVENT_PROGRESS,
              Arguments.createMap().apply {
                putInt("progress", pct)
                putDouble("bytesDownloaded", soFar.toDouble())
                putDouble("bytesTotal", total.toDouble())
              },
            )
            mainHandler.postDelayed(this, POLL_MS)
          } else {
            onDownloadTerminal() // SUCCESSFUL / FAILED
          }
        }
      }
    }
    pollRunnable = runnable
    mainHandler.postDelayed(runnable, POLL_MS)
  }

  /** Success/failure resolution — safe to call from both the receiver and poller. */
  private fun onDownloadTerminal() {
    if (finished) return
    val dm = manager() ?: return
    var status = -1
    var reason = -1
    dm.query(DownloadManager.Query().setFilterById(downloadId))?.use { c ->
      if (c.moveToFirst()) {
        status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
      }
    }
    when (status) {
      DownloadManager.STATUS_SUCCESSFUL -> {
        finished = true
        stopPolling()
        verifyThenComplete()
      }
      DownloadManager.STATUS_FAILED -> failDownload("Download failed (code $reason)")
      else -> Unit // not terminal yet
    }
  }

  /** Hash off the main thread, then post the completion back to it. */
  private fun verifyThenComplete() {
    Thread {
      val file = downloadedFile
      if (file == null || !file.exists()) {
        mainHandler.post { failDownload("Downloaded file missing") }
        return@Thread
      }
      val sha = expectedSha
      if (sha != null) {
        val actual = try { sha256Of(file) } catch (_: Exception) { null }
        if (actual != null && actual != sha) {
          file.delete()
          mainHandler.post { failDownload("Integrity check failed") }
          return@Thread
        }
      }
      mainHandler.post { completeDownload(file) }
    }.start()
  }

  private fun completeDownload(file: File) {
    postInstallNotification(file)
    emit(EVENT_COMPLETE, Arguments.createMap().apply { putString("filePath", file.absolutePath) })
  }

  private fun failDownload(message: String) {
    finished = true
    stopPolling()
    emit(EVENT_ERROR, Arguments.createMap().apply { putString("message", message) })
  }

  // ── Install ─────────────────────────────────────────────────────────────────
  @ReactMethod
  fun install(filePath: String?, promise: Promise) {
    try {
      val file = if (!filePath.isNullOrBlank()) File(filePath) else downloadedFile
      if (file == null || !file.exists()) {
        promise.reject("E_NO_FILE", "No downloaded update to install")
        return
      }
      cancelInstallNotification()
      val intent = installIntent(file)
      (reactContext.currentActivity ?: reactContext).startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_INSTALL", e.message, e)
    }
  }

  private fun installIntent(file: File): Intent {
    val uri = FileProvider.getUriForFile(
      reactContext, "${reactContext.packageName}.otaprovider", file,
    )
    return Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, APK_MIME)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
  }

  // ── "Update ready" notification (background/fallback install path) ──────────
  private fun postInstallNotification(file: File) {
    try {
      ensureChannel()
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
      val pending = PendingIntent.getActivity(reactContext, 0, installIntent(file), flags)
      val notif = NotificationCompat.Builder(reactContext, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_sys_download_done)
        .setContentTitle("Update ready to install")
        .setContentText("Tap to install the latest version")
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pending)
        .build()
      (reactContext.getSystemService(NotificationManager::class.java))?.notify(NOTIF_ID, notif)
    } catch (_: Exception) {
      // POST_NOTIFICATIONS not granted (Android 13+) — foreground install still works.
    }
  }

  private fun cancelInstallNotification() {
    try {
      reactContext.getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
    } catch (_: Exception) {}
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = reactContext.getSystemService(NotificationManager::class.java) ?: return
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      mgr.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_HIGH)
          .apply { description = "Update download and install" },
      )
    }
  }

  // ── Housekeeping ────────────────────────────────────────────────────────────
  private fun stopPolling() {
    pollRunnable?.let { mainHandler.removeCallbacks(it) }
    pollRunnable = null
  }

  private fun cleanup() {
    stopPolling()
    completeReceiver?.let {
      try { reactContext.unregisterReceiver(it) } catch (_: Exception) {}
    }
    completeReceiver = null
    finished = false
    downloadId = -1L
  }

  override fun invalidate() {
    super.invalidate()
    cleanup()
  }

  // NativeEventEmitter contract (RN warns if these are absent).
  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  private fun sha256Of(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buf = ByteArray(8192)
      while (true) {
        val n = input.read(buf)
        if (n <= 0) break
        digest.update(buf, 0, n)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  companion object {
    const val NAME = "OtaUpdater"
    private const val APK_MIME = "application/vnd.android.package-archive"
    private const val CHANNEL_ID = "updates"
    private const val NOTIF_ID = 424242
    private const val POLL_MS = 600L
    private const val EVENT_PROGRESS = "otaDownloadProgress"
    private const val EVENT_COMPLETE = "otaDownloadComplete"
    private const val EVENT_ERROR = "otaDownloadError"
  }
}
