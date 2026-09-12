package com.purnazen

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.res.Configuration
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(com.purnazen.scanquality.ScanQualityPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    createNotificationChannels()
  }

  /**
   * Android 8+ drops any notification aimed at a channel the app has not
   * created, and these are also the per-category toggles the user sees under
   * system Settings → App info → Notifications. Ids must match the backend's
   * category → channel map (notification_service._CHANNEL) and the manifest's
   * default_notification_channel_id.
   */
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.createNotificationChannels(listOf(
      NotificationChannel("appointments", "Appointments",
        NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Booking confirmations, changes and appointment updates"
      },
      NotificationChannel("reminders", "Reminders",
        NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Upcoming appointment and session reminders"
      },
      NotificationChannel("payments", "Payments",
        NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Receipts and payment updates"
      },
      NotificationChannel("offers", "Offers & Promotions",
        NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Discounts, offers and promotional announcements"
      },
      NotificationChannel("general", "General",
        NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Service announcements and everything else"
      },
    ))
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
