package com.supernotetoday

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TodayStoragePackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(TodayStorageModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
