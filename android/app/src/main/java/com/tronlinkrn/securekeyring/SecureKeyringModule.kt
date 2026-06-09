package com.tronlinkrn.securekeyring

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import wallet.core.jni.AnyAddress
import wallet.core.jni.CoinType
import wallet.core.jni.Curve
import wallet.core.jni.HDWallet
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class SecureKeyringModule(reactContext: ReactApplicationContext) :
    NativeSecureKeyringSpec(reactContext) {

    companion object {
        const val NAME = "SecureKeyring"

        init {
            System.loadLibrary("TrustWalletCore")
        }

        private fun ByteArray.toHexString() =
            joinToString("") { String.format(Locale.US, "%02x", it) }

        private fun String.fromHex(): ByteArray {
            val s = removePrefix("0x")
            return ByteArray(s.length / 2) {
                ((s[it * 2].digitToInt(16) shl 4) + s[it * 2 + 1].digitToInt(16)).toByte()
            }
        }

        // Map a JS coinType slip-44 value to wallet-core CoinType enum.
        // Task 4 confirmed CoinType.TRON (195) and CoinType.ETHEREUM (60).
        private fun coin(value: Int): CoinType = when (value) {
            60 -> CoinType.ETHEREUM
            195 -> CoinType.TRON
            else -> CoinType.values().firstOrNull { it.value() == value }
                ?: throw IllegalArgumentException("Unsupported coinType: $value")
        }
    }

    private val wallets = ConcurrentHashMap<String, HDWallet>()

    override fun getName() = NAME

    override fun createWallet(promise: Promise) {
        try {
            val w = HDWallet(128, "")
            val ref = UUID.randomUUID().toString()
            wallets[ref] = w
            val map = com.facebook.react.bridge.Arguments.createMap()
            map.putString("walletRef", ref)
            map.putString("mnemonic", w.mnemonic())
            promise.resolve(map)
        } catch (e: Throwable) {
            promise.reject("create_failed", e)
        }
    }

    override fun importMnemonic(mnemonic: String, promise: Promise) {
        try {
            val wallet = HDWallet(mnemonic, "")
            val ref = UUID.randomUUID().toString()
            wallets[ref] = wallet
            promise.resolve(ref)
        } catch (e: Throwable) {
            promise.reject("import_failed", e.message ?: "Unknown error", e)
        }
    }

    override fun deleteWallet(walletRef: String, promise: Promise) {
        promise.resolve(wallets.remove(walletRef) != null)
    }

    override fun deriveAddress(walletRef: String, coinType: Double, promise: Promise) {
        val wallet = wallets[walletRef]
            ?: return promise.reject("derive_failed", "Unknown wallet ref: $walletRef")
        try {
            promise.resolve(wallet.getAddressForCoin(coin(coinType.toInt())))
        } catch (e: Throwable) {
            promise.reject("derive_failed", e.message ?: "Unknown error", e)
        }
    }

    override fun validateAddress(address: String, coinType: Double): Boolean =
        try {
            AnyAddress.isValid(address, coin(coinType.toInt()))
        } catch (e: Throwable) {
            false
        }

    override fun signHash(walletRef: String, coinType: Double, digestHex: String, promise: Promise) {
        val wallet = wallets[walletRef]
            ?: return promise.reject("sign_failed", "Unknown wallet ref: $walletRef")
        try {
            val key = wallet.getKeyForCoin(coin(coinType.toInt()))
            val sig = key.sign(digestHex.fromHex(), Curve.SECP256K1)
            promise.resolve("0x" + sig.toHexString())
        } catch (e: Throwable) {
            promise.reject("sign_failed", e.message ?: "Unknown error", e)
        }
    }
}
