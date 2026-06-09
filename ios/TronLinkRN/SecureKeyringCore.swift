import Foundation
import WalletCore

@objc(SecureKeyringCore)
public class SecureKeyringCore: NSObject {
    private var wallets: [String: HDWallet] = [:]
    private let lock = NSLock()

    private func coin(_ t: Int) -> CoinType? { CoinType(rawValue: UInt32(t)) }

    @objc public func createWallet() -> [String: String]? {
        guard let w = HDWallet(strength: 128, passphrase: "") else { return nil }
        let ref = UUID().uuidString
        lock.lock(); wallets[ref] = w; lock.unlock()
        return ["walletRef": ref, "mnemonic": w.mnemonic]
    }

    @objc public func importMnemonic(_ mnemonic: String) -> String? {
        guard let w = HDWallet(mnemonic: mnemonic, passphrase: "") else { return nil }
        let ref = UUID().uuidString
        lock.lock(); wallets[ref] = w; lock.unlock()
        return ref
    }

    @objc public func deleteWallet(_ ref: String) -> Bool {
        lock.lock(); let existed = wallets.removeValue(forKey: ref) != nil; lock.unlock()
        return existed
    }

    @objc public func deriveAddress(_ ref: String, coinType: Int) -> String? {
        lock.lock(); let w = wallets[ref]; lock.unlock()
        guard let w = w, let c = coin(coinType) else { return nil }
        return w.getAddressForCoin(coin: c)
    }

    @objc public func validateAddress(_ address: String, coinType: Int) -> Bool {
        guard let c = coin(coinType) else { return false }
        return AnyAddress(string: address, coin: c) != nil
    }

    // digestHex: 0x-prefixed 32-byte hash. Returns 0x-prefixed signature hex.
    @objc public func signHash(_ ref: String, coinType: Int, digestHex: String) -> String? {
        lock.lock(); let w = wallets[ref]; lock.unlock()
        guard let w = w, let c = coin(coinType) else { return nil }
        let clean = digestHex.hasPrefix("0x") ? String(digestHex.dropFirst(2)) : digestHex
        guard let digest = Data(hexString: clean) else { return nil }
        let key = w.getKeyForCoin(coin: c)
        guard let sig = key.sign(digest: digest, curve: .secp256k1) else { return nil }
        return "0x" + sig.map { String(format: "%02x", $0) }.joined()
    }
}

private extension Data {
    init?(hexString: String) {
        guard hexString.count % 2 == 0 else { return nil }
        var data = Data(capacity: hexString.count / 2)
        var idx = hexString.startIndex
        while idx < hexString.endIndex {
            let next = hexString.index(idx, offsetBy: 2)
            guard let b = UInt8(hexString[idx..<next], radix: 16) else { return nil }
            data.append(b); idx = next
        }
        self = data
    }
}
