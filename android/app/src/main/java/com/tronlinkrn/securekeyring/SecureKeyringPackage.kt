package com.tronlinkrn.securekeyring

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class SecureKeyringPackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == SecureKeyringModule.NAME) SecureKeyringModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            SecureKeyringModule.NAME to ReactModuleInfo(
                SecureKeyringModule.NAME,  // name
                SecureKeyringModule.NAME,  // className
                false,                     // canOverrideExistingModule
                false,                     // needsEagerInit
                false,                     // isCxxModule
                true                       // isTurboModule
            )
        )
    }
}
