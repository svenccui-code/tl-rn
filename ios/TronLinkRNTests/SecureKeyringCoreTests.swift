import XCTest
import WalletCore

final class SecureKeyringCoreTests: XCTestCase {
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

    func test_evm_address_matches_canonical() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        XCTAssertEqual(wallet.getAddressForCoin(coin: .ethereum), "0x9858EfFD232B4033E47d90003D41EC34EcaEda94")
    }

    func test_tron_address_matches_pinned() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        XCTAssertEqual(wallet.getAddressForCoin(coin: .tron), "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH")
    }

    func test_signHash_matches_pinned() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        let key = wallet.getKeyForCoin(coin: .tron)
        let digest = Hash.sha256(data: "tronlink-rn golden vector".data(using: .utf8)!)
        let hex = key.sign(digest: digest, curve: .secp256k1)!.map { String(format: "%02x", $0) }.joined()
        XCTAssertEqual("0x\(hex)", "0x356af5e73bb4d7de750d128c1d626eac6ffa5ac951aba32ea1db83b81ab01d1a728f9693dfe716dabfa59720f15ecd5b3c7cf8d407288691965d269a3528cfd500")
    }
}
