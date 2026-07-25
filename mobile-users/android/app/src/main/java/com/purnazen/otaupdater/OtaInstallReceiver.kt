package com.purnazen.otaupdater

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.os.Environment
import androidx.core.app.NotificationCompat
import java.io.File

/**
 * The half of the updater that has to keep working after our own process dies.
 *
 * Two jobs:
 *
 *  1. **Install status.** [OtaUpdaterModule] commits its PackageInstaller session
 *     with a PendingIntent pointing here. Android 12+ can apply a self-update with
 *     no confirmation at all; when it can't, it answers STATUS_PENDING_USER_ACTION
 *     and hands back the intent for its own dialog, which we launch. Failures are
 *     relayed to JS when the bridge is still alive.
 *
 *  2. **Auto-restart.** Installing over ourselves kills the app mid-flight, so no
 *     JS survives to bring it back and the user is left staring at the launcher.
 *     ACTION_MY_PACKAGE_REPLACED is the only hook that runs afterwards: we relaunch
 *     from it (that broadcast is one of the documented exemptions from the
 *     background activity-start restrictions) and post a "tap to open" notification
 *     as a safety net for OEM builds that block the launch anyway. The app clears
 *     that notification on start, so it's only ever visible if the relaunch failed.
 */
class OtaInstallReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_MY_PACKAGE_REPLACED -> onPackageReplaced(context)
      OtaUpdaterModule.ACTION_INSTALL_STATUS -> onInstallStatus(context, intent)
      else -> Unit
    }
  }

  // ── 1. PackageInstaller session callbacks ──────────────────────────────────
  private fun onInstallStatus(context: Context, intent: Intent) {
    when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, NO_STATUS)) {
      NO_STATUS -> Unit // not actually an install-status broadcast
      PackageInstaller.STATUS_PENDING_USER_ACTION -> confirmWithUser(context, intent)
      PackageInstaller.STATUS_SUCCESS -> {
        // Rarely reached on a self-update: the process is usually replaced first.
        purgeDownloads(context)
        OtaUpdaterModule.emitInstallStatus(STATUS_SUCCESS, null)
      }
      PackageInstaller.STATUS_FAILURE_ABORTED ->
        OtaUpdaterModule.emitInstallStatus(STATUS_ERROR, "Install cancelled")
      else -> {
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
        OtaUpdaterModule.emitInstallStatus(
          STATUS_ERROR,
          message?.takeIf { it.isNotBlank() } ?: "Install failed (code $status)",
        )
      }
    }
  }

  /** The OS wants the usual "update this app?" confirmation — show it. */
  private fun confirmWithUser(context: Context, intent: Intent) {
    val confirm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
    }
    if (confirm == null) {
      OtaUpdaterModule.emitInstallStatus(STATUS_ERROR, "Installer unavailable")
      return
    }
    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(confirm)
      OtaUpdaterModule.emitInstallStatus(STATUS_PENDING_USER_ACTION, null)
    } catch (e: Exception) {
      OtaUpdaterModule.emitInstallStatus(STATUS_ERROR, "Could not open the installer")
    }
  }

  // ── 2. Post-update relaunch ────────────────────────────────────────────────
  private fun onPackageReplaced(context: Context) {
    purgeDownloads(context) // the APK we just installed is ~100 MB of dead weight
    // This broadcast fires for *any* replacement, including a manual sideload —
    // only pull the user back into the app when we're the one who installed it.
    if (!consumeRelaunchFlag(context)) return
    val launch = context.packageManager
      .getLaunchIntentForPackage(context.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      ?: return
    postRelaunchNotification(context, launch)
    try {
      context.startActivity(launch)
    } catch (_: Exception) {
      // Blocked by an OEM background-start policy; the notification covers it.
    }
  }

  private fun postRelaunchNotification(context: Context, launch: Intent) {
    try {
      OtaUpdaterModule.ensureChannel(context)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
      val pending = PendingIntent.getActivity(context, 1, launch, flags)
      val notif = NotificationCompat.Builder(context, OtaUpdaterModule.CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_sys_download_done)
        .setContentTitle("Update installed")
        .setContentText("Tap to reopen the app")
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pending)
        .build()
      OtaUpdaterModule.notificationManager(context)
        ?.notify(OtaUpdaterModule.NOTIF_ID_RELAUNCH, notif)
    } catch (_: Exception) {
      // POST_NOTIFICATIONS not granted — the direct relaunch is the only path.
    }
  }

  /** Reads and clears the "we installed this" marker set by OtaUpdaterModule. */
  private fun consumeRelaunchFlag(context: Context): Boolean = try {
    val prefs = context.getSharedPreferences(OtaUpdaterModule.PREFS, Context.MODE_PRIVATE)
    val pending = prefs.getBoolean(OtaUpdaterModule.KEY_RELAUNCH, false)
    if (pending) prefs.edit().remove(OtaUpdaterModule.KEY_RELAUNCH).apply()
    pending
  } catch (_: Exception) {
    false
  }

  private fun purgeDownloads(context: Context) {
    try {
      context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        ?.listFiles { f: File -> f.name.startsWith("purnazen-update-") && f.name.endsWith(".apk") }
        ?.forEach { it.delete() }
    } catch (_: Exception) {
      // Best-effort cleanup; a stale APK is overwritten by the next download.
    }
  }

  companion object {
    private const val NO_STATUS = Int.MIN_VALUE
    const val STATUS_SUCCESS = "success"
    const val STATUS_ERROR = "error"
    const val STATUS_PENDING_USER_ACTION = "pending_user_action"
  }
}
