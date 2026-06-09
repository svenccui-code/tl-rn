#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
// Import React-RCTAppDelegate headers so that the generated TronLinkRN-Swift.h
// can resolve RCTDefaultReactNativeFactoryDelegate (declared in AppDelegate.swift)
#import <RCTDefaultReactNativeFactoryDelegate.h>
#import "TronLinkRN-Swift.h"

#import <SecureKeyringSpec/SecureKeyringSpec.h>

@interface SecureKeyring : NSObject <NativeSecureKeyringSpec>
@end

@implementation SecureKeyring {
    SecureKeyringCore *_core;
}
RCT_EXPORT_MODULE()

- (instancetype)init {
    if (self = [super init]) {
        _core = [SecureKeyringCore new];
    }
    return self;
}

- (void)createWallet:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
  NSDictionary *r = [_core createWallet];
  r ? resolve(r) : reject(@"create_failed", @"could not create wallet", nil);
}

- (void)importMnemonic:(NSString *)mnemonic
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    NSString *ref = [_core importMnemonic:mnemonic];
    ref ? resolve(ref) : reject(@"import_failed", @"invalid mnemonic", nil);
}

- (void)deleteWallet:(NSString *)walletRef
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
    resolve(@([_core deleteWallet:walletRef]));
}

- (void)deriveAddress:(NSString *)walletRef
             coinType:(double)coinType
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
    NSString *a = [_core deriveAddress:walletRef coinType:(NSInteger)coinType];
    a ? resolve(a) : reject(@"derive_failed", @"unknown ref or coin", nil);
}

- (NSNumber *)validateAddress:(NSString *)address coinType:(double)coinType {
    return @([_core validateAddress:address coinType:(NSInteger)coinType]);
}

- (void)signHash:(NSString *)walletRef
        coinType:(double)coinType
       digestHex:(NSString *)digestHex
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
    NSString *sig = [_core signHash:walletRef coinType:(NSInteger)coinType digestHex:digestHex];
    sig ? resolve(sig) : reject(@"sign_failed", @"unknown ref/coin or bad digest", nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeSecureKeyringSpecJSI>(params);
}

@end
