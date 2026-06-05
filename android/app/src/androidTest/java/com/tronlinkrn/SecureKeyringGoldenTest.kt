package com.tronlinkrn

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Test
import org.junit.runner.RunWith
import wallet.core.jni.CoinType
import wallet.core.jni.Curve
import wallet.core.jni.HDWallet
import wallet.core.jni.Hash
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class SecureKeyringGoldenTest {
    companion object {
        const val MNEMONIC =
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

        @JvmStatic
        @BeforeClass
        fun load() {
            System.loadLibrary("TrustWalletCore")
        }

        fun ByteArray.hex() = joinToString("") { String.format(Locale.US, "%02x", it) }
    }

    @Test
    fun evm_address_matches_canonical() {
        val w = HDWallet(MNEMONIC, "")
        assertEquals("0x9858EfFD232B4033E47d90003D41EC34EcaEda94", w.getAddressForCoin(CoinType.ETHEREUM))
    }

    @Test
    fun tron_address_matches_pinned() {
        val w = HDWallet(MNEMONIC, "")
        assertEquals("TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH", w.getAddressForCoin(CoinType.TRON))
    }

    @Test
    fun signHash_matches_pinned() {
        val w = HDWallet(MNEMONIC, "")
        val key = w.getKeyForCoin(CoinType.TRON)
        val digest = Hash.sha256("tronlink-rn golden vector".toByteArray(Charsets.UTF_8))
        val sig = key.sign(digest, Curve.SECP256K1)
        assertEquals(
            "0x356af5e73bb4d7de750d128c1d626eac6ffa5ac951aba32ea1db83b81ab01d1a728f9693dfe716dabfa59720f15ecd5b3c7cf8d407288691965d269a3528cfd500",
            "0x" + sig.hex()
        )
    }
}
