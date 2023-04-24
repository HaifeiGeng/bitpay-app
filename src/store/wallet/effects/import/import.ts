import {
  Key,
  KeyMethods,
  KeyOptions,
  KeyProperties,
  Wallet,
} from '../../wallet.models';
import {Effect} from '../../../index';
import {BwcProvider} from '../../../../lib/bwc';
import merge from 'lodash.merge';
import {
  buildKeyObj,
  buildMigrationKeyObj,
  buildWalletObj,
  findKeyByKeyId,
  findMatchedKeyAndUpdate,
  getMatchedKey,
  getReadOnlyKey,
  isMatch,
  isMatchedWallet,
  mapAbbreviationAndName,
} from '../../utils/wallet';
import {LogActions} from '../../../../store/log';
import {
  deleteKey,
  failedImport,
  setCustomizeNonce,
  setEnableReplaceByFee,
  setUseUnconfirmedFunds,
  setWalletTermsAccepted,
  successImport,
  updateCacheFeeLevel,
  updatePortfolioBalance,
} from '../../wallet.actions';
import {
  BitpaySupportedEthereumTokenOpts,
  BitpaySupportedTokenOpts,
} from '../../../../constants/tokens';
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {
  biometricLockActive,
  currentPin,
  dismissOnGoingProcessModal,
  pinLockActive,
  setAnnouncementsAccepted,
  setColorScheme,
  setDefaultAltCurrency,
  setHomeCarouselConfig,
  setIntroCompleted,
  setKeyMigrationFailure,
  setOnboardingCompleted,
  showBottomNotificationModal,
  showPortfolioValue,
  successGenerateAppIdentity,
} from '../../../app/app.actions';
import {createContact} from '../../../contact/contact.actions';
import {ContactRowProps} from '../../../../components/list/ContactRow';
import {Network} from '../../../../constants';
import {successPairingBitPayId} from '../../../bitpay-id/bitpay-id.actions';
import {AppIdentity} from '../../../app/app.models';
import {
  startUpdateAllKeyAndWalletStatus,
  startUpdateAllWalletStatusForKey,
} from '../status/status';
import {startGetRates} from '../rates/rates';
import {
  accessTokenSuccess,
  coinbaseGetAccountsAndBalance,
  coinbaseGetUser,
} from '../../../coinbase';
import {
  CoinbaseEnvironment,
  CoinbaseTokenProps,
} from '../../../../api/coinbase/coinbase.types';
import {coinbaseUpdateExchangeRate} from '../../../coinbase/coinbase.effects';
import {hashPin} from '../../../../components/modal/pin/PinModal';
import {navigationRef} from '../../../../Root';
import {
  CardConfigMap,
  GiftCard,
  LegacyGiftCard,
} from '../../../shop/shop.models';
import {ShopActions} from '../../../shop';
import {initialShopState} from '../../../shop/shop.reducer';
import {StackActions} from '@react-navigation/native';
import {BuyCryptoActions} from '../../../buy-crypto';
import {SwapCryptoActions} from '../../../swap-crypto';
import {Analytics} from '../../../analytics/analytics.effects';
import {
  checkNotificationsPermissions,
  setConfirmTxNotifications,
  setNotifications,
  subscribePushNotifications,
  subscribeEmailNotifications,
} from '../../../app/app.effects';
import {t} from 'i18next';
import {sleep} from '../../../../utils/helper-methods';
import {backupRedirect} from '../../../../navigation/wallet/screens/Backup';

const BWC = BwcProvider.getInstance();

const cordovaStoragePath =
  Platform.OS === 'ios'
    ? RNFS.LibraryDirectoryPath + '/NoCloud/'
    : RNFS.DocumentDirectoryPath + '/';

export const normalizeMnemonic = (words?: string): string | undefined => {
  if (!words || !words.indexOf) {
    return words;
  }

  // \u3000: A space of non-variable width: used in Chinese, Japanese, Korean
  const isJA = words.indexOf('\u3000') > -1;
  const wordList = words
    .trim()
    .toLowerCase()
    .split(/[\u3000\s]+/);

  return wordList.join(isJA ? '\u3000' : ' ');
};

export const startMigration =
  (): Effect<Promise<void>> =>
  async (dispatch): Promise<void> => {
    return new Promise(async resolve => {
      dispatch(LogActions.info('[startMigration] - starting...'));
      const goToNewUserOnboarding = () => {
        dispatch(setIntroCompleted());
        navigationRef.dispatch(
          StackActions.replace('Onboarding', {
            screen: 'OnboardingStart',
          }),
        );
      };

      // keys and wallets
      try {
        dispatch(LogActions.info('[startMigration] - keys and wallets'));
        // cordova directory not found
        if (!(await RNFS.exists(cordovaStoragePath))) {
          dispatch(
            LogActions.info('Directory not found -> new user onboarding'),
          );
          goToNewUserOnboarding();
          return resolve();
        }
        dispatch(LogActions.info('[startMigration] - directory found'));

        const files = (await RNFS.readDir(cordovaStoragePath)) as {
          name: string;
        }[];

        // key file does not exist
        if (!files.find(file => file.name === 'keys')) {
          dispatch(
            LogActions.info('Key file not found -> new user onboarding'),
          );
          goToNewUserOnboarding();
          return resolve();
        }
        dispatch(LogActions.info('[startMigration] - key file found'));

        const keys = JSON.parse(
          await RNFS.readFile(cordovaStoragePath + 'keys', 'utf8'),
        ) as KeyProperties[];

        const profile = JSON.parse(
          await RNFS.readFile(cordovaStoragePath + 'profile', 'utf8'),
        ) as {credentials: Wallet[]};

        // no keys
        if (!keys.length) {
          dispatch(LogActions.info('No keys -> new user onboarding'));
          goToNewUserOnboarding();
          return resolve();
        }

        dispatch(LogActions.info('[startMigration] - has keys'));

        for (const key of keys) {
          const wallets = profile.credentials.filter(
            credentials => credentials.keyId === key.id,
          );
          let keyName: string | undefined;
          let backupComplete: string | undefined;
          try {
            keyName = (await RNFS.readFile(
              cordovaStoragePath + `Key-${key.id}`,
              'utf8',
            )) as string;
          } catch (e: unknown) {
            // not found. Continue anyway
            let errorStr;
            if (e instanceof Error) {
              errorStr = e.message;
            } else {
              errorStr = JSON.stringify(e);
            }
            dispatch(
              LogActions.info(
                '[startMigration] - not found. Continue anyway... ' + errorStr,
              ),
            );
          }

          dispatch(LogActions.info('[startMigration] - backup complete'));
          try {
            backupComplete = (await RNFS.readFile(
              cordovaStoragePath + `walletGroupBackup-${key.id}`,
              'utf8',
            )) as string;
          } catch (e: unknown) {
            // not found. Continue anyway
            let errorStr;
            if (e instanceof Error) {
              errorStr = e.message;
            } else {
              errorStr = JSON.stringify(e);
            }
            dispatch(
              LogActions.info(
                '[startMigration] - not found. Continue anyway... ' + errorStr,
              ),
            );
          }
          const keyConfig = {
            backupComplete: !!backupComplete,
            keyName,
          };
          await dispatch(migrateKeyAndWallets({key, wallets, keyConfig}));
          dispatch(setHomeCarouselConfig({id: key.id, show: true}));
          dispatch(LogActions.info('[startMigration] - success key migration'));
        }

        // update store with token rates from coin gecko and update balances
        await dispatch(startGetRates({force: true}));
        await dispatch(startUpdateAllKeyAndWalletStatus({force: true}));
        dispatch(
          LogActions.info(
            '[startMigration] - success migration keys and wallets',
          ),
        );
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(LogActions.info('Failed to migrate keys: ' + errorStr));
        // flag for showing error modal
        dispatch(setKeyMigrationFailure());
      }

      // config
      let emailNotificationsConfig: {email: string} = {email: ''};
      try {
        dispatch(
          LogActions.info('[startMigration] - Migrating config settings'),
        );
        const config = JSON.parse(
          await RNFS.readFile(cordovaStoragePath + 'config', 'utf8'),
        );

        const {
          confirmedTxsNotifications,
          emailNotifications,
          pushNotifications,
          offersAndPromotions,
          productsUpdates,
          totalBalance,
          feeLevels,
          theme,
          lock,
          wallet,
        } = config || {};

        emailNotificationsConfig = emailNotifications;

        // push notifications
        const systemEnabled = await checkNotificationsPermissions();
        if (systemEnabled) {
          if (pushNotifications?.enabled) {
            dispatch(setNotifications(true));
            if (confirmedTxsNotifications?.enabled) {
              dispatch(setConfirmTxNotifications(true));
            }
            if (offersAndPromotions?.enabled || productsUpdates?.enabled) {
              dispatch(setAnnouncementsAccepted(true));
            }
          }
        }

        // lock
        if (lock) {
          const {method, value} = lock;
          if (method === 'pin') {
            dispatch(currentPin(hashPin(value.split(''))));
            dispatch(pinLockActive(true));
          } else if (method === 'fingerprint') {
            dispatch(biometricLockActive(true));
          }
        }

        // settings
        if (wallet) {
          const {
            showCustomizeNonce,
            showEnableRBF,
            spendUnconfirmed,
            settings: {alternativeIsoCode: isoCode, alternativeName: name},
          } = wallet;
          dispatch(setDefaultAltCurrency({isoCode, name}));
          dispatch(setCustomizeNonce(showCustomizeNonce));
          dispatch(setUseUnconfirmedFunds(spendUnconfirmed));
          dispatch(setEnableReplaceByFee(showEnableRBF));
        }
        // portfolio balance hide/show
        if (totalBalance) {
          dispatch(showPortfolioValue(totalBalance.show));
        }

        // fee level policy
        if (feeLevels) {
          Object.keys(feeLevels).forEach(currency => {
            dispatch(
              updateCacheFeeLevel({
                currency: currency as 'btc' | 'eth',
                feeLevel: feeLevels[currency],
              }),
            );
          });
        }

        // theme
        if (theme) {
          dispatch(
            setColorScheme(
              theme.system ? null : theme.name === 'light' ? 'light' : 'dark',
            ),
          );
        }

        dispatch(LogActions.info('Successfully migrated config settings'));
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(
          LogActions.info('Failed to migrate config settings: ' + errorStr),
        );
      }

      // buy crypto
      // simplex
      try {
        dispatch(LogActions.info('[startMigration] - Migrating simplex'));
        const buyCryptoSimplexData = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'simplex-production',
            'utf8',
          ).catch(_ => '{}'),
        ) as any;
        Object.values(buyCryptoSimplexData).forEach(
          (simplexPaymentData: any) => {
            simplexPaymentData.env = 'prod';
            delete simplexPaymentData.error;
            dispatch(
              BuyCryptoActions.successPaymentRequestSimplex({
                simplexPaymentData,
              }),
            );
          },
        );
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(LogActions.info('Failed to migrate simplex: ' + errorStr));
      }

      // wyre
      try {
        dispatch(LogActions.info('[startMigration] - Migrating wyre'));
        const buyCryptoWyreData = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'wyre-production',
            'utf8',
          ).catch(_ => '{}'),
        ) as any;
        Object.values(buyCryptoWyreData).forEach((wyrePaymentData: any) => {
          wyrePaymentData.env = 'prod';
          delete wyrePaymentData.error;
          dispatch(
            BuyCryptoActions.successPaymentRequestWyre({
              wyrePaymentData,
            }),
          );
        });
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(LogActions.info('Failed to migrate wyre: ' + errorStr));
      }

      // swap crypto
      // changelly
      try {
        dispatch(LogActions.info('[startMigration] - Migrating changelly'));
        const swapCryptoChangellyData = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'changelly-production',
            'utf8',
          ).catch(_ => '{}'),
        ) as any;
        Object.values(swapCryptoChangellyData).forEach(
          (changellyTxData: any) => {
            changellyTxData.env = 'prod';
            delete changellyTxData.error;
            dispatch(
              SwapCryptoActions.successTxChangelly({
                changellyTxData,
              }),
            );
          },
        );
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(LogActions.info('Failed to migrate changelly: ' + errorStr));
      }

      // gift cards
      try {
        dispatch(LogActions.info('[startMigration] - Migrating gift cards'));
        const supportedCardMap = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'giftCardConfigCache',
            'utf8',
          ).catch(_ => '{}'),
        ) as CardConfigMap;
        dispatch(
          ShopActions.successFetchCatalog({
            availableCardMap: supportedCardMap || {},
            categoriesAndCurations: initialShopState.categoriesAndCurations,
            integrations: initialShopState.integrations,
          }),
        );
        const supportedCardNames = Object.keys(supportedCardMap);
        const getStorageKey = (cardName: string) => {
          switch (cardName) {
            case 'Amazon.com':
              return 'amazonGiftCards-livenet';
            case 'Amazon.co.jp':
              return 'amazonGiftCards-livenet-japan';
            case 'Mercado Livre':
              return 'MercadoLibreGiftCards-livenet';
            default:
              return `giftCards-${cardName}-livenet`;
          }
        };
        const purchasedCardPromises = supportedCardNames.map(cardName =>
          RNFS.readFile(
            cordovaStoragePath + getStorageKey(cardName),
            'utf8',
          ).catch(_ => '{}'),
        );
        const purchasedCardResponses = await Promise.all(purchasedCardPromises);
        const purchasedCards = purchasedCardResponses
          .map(res => {
            try {
              return JSON.parse(res);
            } catch (err) {}
            return {};
          })
          .map((giftCardMap: {[invoiceId: string]: LegacyGiftCard}) => {
            const legacyGiftCards = Object.values(giftCardMap);
            const migratedGiftCards = legacyGiftCards.map(legacyGiftCard => ({
              ...legacyGiftCard,
              clientId: legacyGiftCard.uuid,
            }));
            return migratedGiftCards as GiftCard[];
          })
          .filter(brand => brand.length);
        const allGiftCards = purchasedCards
          .flat()
          .filter(
            giftCard =>
              supportedCardNames.includes(giftCard.name) &&
              giftCard.status !== 'UNREDEEMED',
          );
        const numActiveGiftCards = allGiftCards.filter(
          giftCard => !giftCard.archived,
        ).length;
        const giftCards = allGiftCards.map(giftCard => ({
          ...giftCard,
          archived: numActiveGiftCards > 3 ? true : giftCard.archived,
        }));
        dispatch(ShopActions.setPurchasedGiftCards({giftCards}));

        const giftCardEmail = await RNFS.readFile(
          cordovaStoragePath + 'amazonUserInfo',
          'utf8',
        )
          .then(
            (emailObjectString: string) => JSON.parse(emailObjectString).email,
          )
          .catch(_ => '');
        const email = giftCardEmail || emailNotificationsConfig?.email;
        dispatch(ShopActions.updatedEmailAddress({email}));

        const phoneCountryInfoPromise = async () => {
          try {
            return JSON.parse(
              await RNFS.readFile(
                cordovaStoragePath + 'phoneCountryInfo',
                'utf8',
              ),
            );
          } catch (e) {}
        };

        const [phone, phoneCountryInfo] = await Promise.all([
          RNFS.readFile(cordovaStoragePath + 'phone', 'utf8'),
          phoneCountryInfoPromise(),
        ]);
        if (phone && phoneCountryInfo) {
          dispatch(ShopActions.updatedPhone({phone, phoneCountryInfo}));
        }
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(LogActions.info('Failed to migrate gift cards: ' + errorStr));
      }

      // address book
      try {
        dispatch(LogActions.info('[startMigration] - Migrating address book'));
        const addressBook = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'addressbook-v2-livenet',
            'utf8',
          ),
        ) as {[key in string]: ContactRowProps};
        Object.values(addressBook).forEach((contact: ContactRowProps) => {
          dispatch(createContact(contact));
        });
        dispatch(LogActions.info('Successfully migrated address book'));
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(
          LogActions.info('Failed to migrate address book: ' + errorStr),
        );
      }

      // app identity
      try {
        dispatch(LogActions.info('[startMigration] - Migrating app identity'));
        const identity = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'appIdentity-livenet',
            'utf8',
          ),
        ) as AppIdentity;
        dispatch(LogActions.info('Successfully migrated app identity'));
        dispatch(successGenerateAppIdentity(Network.mainnet, identity));
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(
          LogActions.info('Failed to migrate app identity: ' + errorStr),
        );
      }

      // bitpay id
      try {
        dispatch(LogActions.info('[startMigration] - Migrating bitpay id'));
        const token = await RNFS.readFile(
          cordovaStoragePath + 'bitpayIdToken-livenet',
          'utf8',
        );
        dispatch(LogActions.info('Successfully migrated bitpay id'));
        await dispatch(successPairingBitPayId(Network.mainnet, token));
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(LogActions.info('Failed to migrate bitpay id: ' + errorStr));
      }

      // coinbase
      try {
        dispatch(
          LogActions.info('[startMigration] - Migrating Coinbase tokens'),
        );
        const account = JSON.parse(
          await RNFS.readFile(
            cordovaStoragePath + 'coinbase-production',
            'utf8',
          ),
        ) as {token: CoinbaseTokenProps};
        dispatch(
          accessTokenSuccess(CoinbaseEnvironment.production, account.token),
        );
        await dispatch(coinbaseGetUser());
        await dispatch(coinbaseUpdateExchangeRate());
        await dispatch(coinbaseGetAccountsAndBalance());
        dispatch(
          setHomeCarouselConfig({id: 'coinbaseBalanceCard', show: true}),
        );
        dispatch(LogActions.info('Successfully migrated Coinbase account'));
      } catch (err: unknown) {
        let errorStr;
        if (err instanceof Error) {
          errorStr = err.message;
        } else {
          errorStr = JSON.stringify(err);
        }
        dispatch(
          LogActions.info('Failed to migrate Coinbase account: ' + errorStr),
        );
      }

      dispatch(setOnboardingCompleted());
      dispatch(setWalletTermsAccepted());

      dispatch(LogActions.info('success [startMigration]'));
      resolve();
    });
  };

export const migrateKeyAndWallets =
  (migrationData: {
    key: KeyProperties;
    wallets: any[];
    keyConfig: {
      backupComplete: boolean;
      keyName: string | undefined;
    };
  }): Effect<Promise<void>> =>
  async (dispatch, getState) => {
    return new Promise(async (resolve, reject) => {
      try {
        dispatch(LogActions.info('starting [migrateKeyAndWallets]'));
        const state = getState();
        const {backupComplete, keyName} = migrationData.keyConfig;
        const tokenOpts = {
          ...BitpaySupportedEthereumTokenOpts,
          ...state.WALLET.tokenOptions,
          ...state.WALLET.customTokenOptions,
        };
        const keyObj = merge(migrationData.key, {
          methods: BWC.createKey({
            seedType: 'object',
            seedData: migrationData.key,
          }),
        });

        let wallets = [];
        dispatch(LogActions.info('[migrateKeyAndWallets] - wallets migration'));
        for (const wallet of migrationData.wallets) {
          const walletObj = await BWC.getClient(JSON.stringify(wallet));
          let hideBalance: boolean | undefined;
          let hideWallet: boolean | undefined;
          try {
            const id = walletObj.credentials.walletId;
            hideBalance =
              (await RNFS.readFile(
                cordovaStoragePath + `hideBalance-${id}`,
                'utf8',
              )) === 'true';
            hideWallet =
              (await RNFS.readFile(
                cordovaStoragePath + `hideWallet-${id}`,
                'utf8',
              )) === 'true';
          } catch (e) {
            // not found. Continue anyway
          }

          const {currencyAbbreviation, currencyName} = dispatch(
            mapAbbreviationAndName(
              walletObj.credentials.coin,
              walletObj.credentials.chain,
            ),
          );

          wallets.push(
            merge(
              walletObj,
              buildWalletObj(
                {
                  ...walletObj.credentials,
                  hideBalance,
                  hideWallet,
                  currencyAbbreviation,
                  currencyName,
                },
                tokenOpts,
              ),
            ),
          );
          dispatch(
            LogActions.info(
              '[migrateKeyAndWallets] - success wallet migration',
            ),
          );
        }

        const tokens: Wallet[] = wallets.filter(
          (wallet: Wallet) => !!wallet.credentials.token,
        );

        if (tokens && !!tokens.length) {
          dispatch(LogActions.info('starting [linkTokenToWallet]'));
          wallets = linkTokenToWallet(tokens, wallets);
          dispatch(LogActions.info('success [linkTokenToWallet]'));
        }

        const key = buildMigrationKeyObj({
          key: keyObj,
          wallets,
          backupComplete,
          keyName,
        });

        dispatch(
          successImport({
            key,
          }),
        );
        dispatch(LogActions.info('success [migrateKeyAndWallets]'));
        resolve();
      } catch (e) {
        let errorStr;
        if (e instanceof Error) {
          errorStr = e.message;
        } else {
          errorStr = JSON.stringify(e);
        }
        dispatch(failedImport());
        dispatch(
          LogActions.error(`failed [migrateKeyAndWallets]: ${errorStr}`),
        );
        reject(e);
      }
    });
  };

export const startImportMnemonic =
  (
    importData: {words?: string; xPrivKey?: string},
    opts: Partial<KeyOptions>,
  ): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          WALLET,
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();
        const tokenOpts = {
          ...BitpaySupportedTokenOpts,
          ...WALLET.tokenOptions,
          ...WALLET.customTokenOptions,
        };
        const {words, xPrivKey} = importData;
        opts.words = normalizeMnemonic(words);
        opts.xPrivKey = xPrivKey;

        const data = await serverAssistedImport(opts);

        // To Avoid Duplicate wallet import
        const {key: _key, wallets} = findMatchedKeyAndUpdate(
          data.wallets,
          data.key,
          Object.values(WALLET.keys),
          opts,
        );

        // To clear encrypt password
        if (opts.keyId && isMatch(_key, WALLET.keys[opts.keyId])) {
          dispatch(deleteKey({keyId: opts.keyId}));
        }

        const key = buildKeyObj({
          key: _key,
          wallets: wallets.map(wallet => {
            // subscribe new wallet to push notifications
            if (notificationsAccepted) {
              dispatch(subscribePushNotifications(wallet, brazeEid!));
            }
            // subscribe new wallet to email notifications
            if (
              emailNotifications &&
              emailNotifications.accepted &&
              emailNotifications.email
            ) {
              const prefs = {
                email: emailNotifications.email,
                language: defaultLanguage,
                unit: 'btc', // deprecated
              };
              dispatch(subscribeEmailNotifications(wallet, prefs));
            }
            const {currencyAbbreviation, currencyName} = dispatch(
              mapAbbreviationAndName(
                wallet.credentials.coin,
                wallet.credentials.chain,
              ),
            );
            return merge(
              wallet,
              buildWalletObj(
                {...wallet.credentials, currencyAbbreviation, currencyName},
                tokenOpts,
              ),
            );
          }),
          backupComplete: true,
        });

        dispatch(
          successImport({
            key,
          }),
        );
        resolve(key);
      } catch (e) {
        dispatch(failedImport());
        reject(e);
      }
    });
  };

export const startImportFile =
  (decryptBackupText: string, opts: Partial<KeyOptions>): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          WALLET,
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();
        const tokenOpts = {
          ...BitpaySupportedTokenOpts,
          ...WALLET.tokenOptions,
          ...WALLET.customTokenOptions,
        };
        let {key: _key, wallet} = await createKeyAndCredentialsWithFile(
          decryptBackupText,
          opts,
        );
        let wallets = [wallet];

        const matchedKey = _key
          ? getMatchedKey(_key, Object.values(WALLET.keys))
          : getReadOnlyKey(Object.values(WALLET.keys));

        if (matchedKey && !opts?.keyId) {
          _key = matchedKey.methods;
          opts.keyId = null;
          if (isMatchedWallet(wallets[0], matchedKey.wallets)) {
            throw new Error(t('The wallet is already in the app.'));
          }
          wallets[0].keyId = matchedKey.id;
          wallets = wallets.concat(matchedKey.wallets);
        }

        // To clear encrypt password
        if (opts.keyId && matchedKey) {
          let filteredKeys = matchedKey.wallets.filter(
            w => w.credentials.walletId !== wallets[0].credentials.walletId,
          );
          filteredKeys.forEach(w => (w.credentials.keyId = w.keyId = _key.id));
          wallets = wallets.concat(filteredKeys);
          dispatch(deleteKey({keyId: opts.keyId}));
        }

        const key = buildKeyObj({
          key: _key,
          wallets: wallets.map(wallet => {
            // subscribe new wallet to push notifications
            if (notificationsAccepted) {
              dispatch(subscribePushNotifications(wallet, brazeEid!));
            }
            // subscribe new wallet to email notifications
            if (
              emailNotifications &&
              emailNotifications.accepted &&
              emailNotifications.email
            ) {
              const prefs = {
                email: emailNotifications.email,
                language: defaultLanguage,
                unit: 'btc', // deprecated
              };
              dispatch(subscribeEmailNotifications(wallet, prefs));
            }
            const {currencyAbbreviation, currencyName} = dispatch(
              mapAbbreviationAndName(
                wallet.credentials.coin,
                wallet.credentials.chain,
              ),
            );
            return merge(
              wallet,
              buildWalletObj(
                {...wallet.credentials, currencyAbbreviation, currencyName},
                tokenOpts,
              ),
            );
          }),
          backupComplete: true,
        });

        dispatch(
          successImport({
            key,
          }),
        );
        resolve(key);
      } catch (e) {
        dispatch(failedImport());
        reject(e);
      }
    });
  };


  

// Server assisted import will not find any third party wallet only the ones already created in bws.
export const startImportWithDerivationPath =
  (
    importData: {words?: string; xPrivKey?: string},
    opts: Partial<KeyOptions>,
  ): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          WALLET,
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();
        const tokenOpts = {
          ...BitpaySupportedTokenOpts,
          ...WALLET.tokenOptions,
          ...WALLET.customTokenOptions,
        };
        const {words, xPrivKey} = importData;
        opts.mnemonic = words;
        opts.extendedPrivateKey = xPrivKey;
        const showOpts = Object.assign({}, opts);
        if (showOpts.extendedPrivateKey) {
          showOpts.extendedPrivateKey = '[hidden]';
        }
        if (showOpts.mnemonic) {
          showOpts.mnemonic = '[hidden]';
        }
        dispatch(
          LogActions.info(
            `Importing Wallet with derivation path: ${JSON.stringify(
              showOpts,
            )}`,
          ),
        );
        const data = await createKeyAndCredentials(opts);
        const {wallet, key: _key} = data;
        wallet.openWallet(async (err: Error) => {
          if (err) {
            if (err.message.indexOf('not found') > 0) {
              err = new Error('WALLET_DOES_NOT_EXIST');
            }
            return reject(err);
          }
          // subscribe new wallet to push notifications
          if (notificationsAccepted) {
            dispatch(subscribePushNotifications(wallet, brazeEid!));
          }
          // subscribe new wallet to email notifications
          if (
            emailNotifications &&
            emailNotifications.accepted &&
            emailNotifications.email
          ) {
            const prefs = {
              email: emailNotifications.email,
              language: defaultLanguage,
              unit: 'btc', // deprecated
            };
            dispatch(subscribeEmailNotifications(wallet, prefs));
          }
          const {currencyAbbreviation, currencyName} = dispatch(
            mapAbbreviationAndName(
              wallet.credentials.coin,
              wallet.credentials.chain,
            ),
          );
          console.log("---------- 使用派生路径导入: WALLET", JSON.stringify(WALLET));
          let key;
          const matchedKey = getMatchedKey(_key, Object.values(WALLET.keys));
          console.log("---------- 使用派生路径导入: matchedKey", JSON.stringify(matchedKey));
          if (matchedKey) {
            // To avoid duplicate key creation when importing
            wallet.credentials.keyId = wallet.keyId = matchedKey.id;
            key = await findKeyByKeyId(matchedKey.id, WALLET.keys);
            key.wallets.push(
              merge(
                wallet,
                buildWalletObj(
                  {
                    ...wallet.credentials,
                    currencyAbbreviation,
                    currencyName,
                  },
                  tokenOpts,
                ),
              ),
            );
          } else {
            key = buildKeyObj({
              key: _key,
              wallets: [
                merge(
                  wallet,
                  buildWalletObj(
                    {...wallet.credentials, currencyAbbreviation, currencyName},
                    tokenOpts,
                  ),
                ),
              ],
              backupComplete: true,
            });
          }
          console.log("---------- 使用派生路径导入: 最后的key", JSON.stringify(key));
          dispatch(
            successImport({
              key,
            }),
          );
          resolve(key);
        });
      } catch (e) {
        dispatch(failedImport());
        reject(e);
      }
    });
  };


  /**
   * 开始导入冷钱包
   * @param importData 
   * @param opts 
   * @returns 
   */
  export const startImportColdWallet =
  (
    importData: {words?: string; xPrivKey?: string},
    opts: Partial<KeyOptions>,
  ): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          WALLET,
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();
        const tokenOpts = {
          ...BitpaySupportedTokenOpts,
          ...WALLET.tokenOptions,
          ...WALLET.customTokenOptions,
        };
        const {words, xPrivKey} = importData;
        opts.mnemonic = words;
        opts.extendedPrivateKey = xPrivKey;
        const showOpts = Object.assign({}, opts);
        if (showOpts.extendedPrivateKey) {
          showOpts.extendedPrivateKey = '[hidden]';
        }
        if (showOpts.mnemonic) {
          showOpts.mnemonic = '[hidden]';
        }
        dispatch(
          LogActions.info(
            `Importing Wallet with derivation path: ${JSON.stringify(
              showOpts,
            )}`,
          ),
        );
        // 增加冷钱包标记
        opts.cold = '1';
        const data = await createKeyAndCredentials(opts);
        console.log("---------- 使用助记词导入冷钱包: data", JSON.stringify(data));
        const {wallet, key: _key} = data;
        wallet.openWalletTest(async (err: Error) => {
          if (err) {
            if (err.message.indexOf('not found') > 0) {
              err = new Error('WALLET_DOES_NOT_EXIST');
            }
            return reject(err);
          }
          // subscribe new wallet to push notifications
          if (notificationsAccepted) {
            dispatch(subscribePushNotifications(wallet, brazeEid!));
          }
          // subscribe new wallet to email notifications
          if (
            emailNotifications &&
            emailNotifications.accepted &&
            emailNotifications.email
          ) {
            const prefs = {
              email: emailNotifications.email,
              language: defaultLanguage,
              unit: 'btc', // deprecated
            };
            dispatch(subscribeEmailNotifications(wallet, prefs));
          }
          const {currencyAbbreviation, currencyName} = dispatch(
            mapAbbreviationAndName(
              wallet.credentials.coin,
              wallet.credentials.chain,
            ),
          );
          console.log("---------- 使用派生路径导入: WALLET", JSON.stringify(WALLET));
          let key;
          const matchedKey = getMatchedKey(_key, Object.values(WALLET.keys));
          console.log("---------- 使用派生路径导入: matchedKey", JSON.stringify(matchedKey));
          if (matchedKey) {
            // To avoid duplicate key creation when importing
            wallet.credentials.keyId = wallet.keyId = matchedKey.id;
            key = await findKeyByKeyId(matchedKey.id, WALLET.keys);
            key.wallets.push(
              merge(
                wallet,
                buildWalletObj(
                  {
                    ...wallet.credentials,
                    currencyAbbreviation,
                    currencyName,
                  },
                  tokenOpts,
                ),
              ),
            );
          } else {
            key = buildKeyObj({
              key: _key,
              wallets: [
                merge(
                  wallet,
                  buildWalletObj(
                    {...wallet.credentials, currencyAbbreviation, currencyName},
                    tokenOpts,
                  ),
                ),
              ],
              backupComplete: true,
            });
          }
          console.log("---------- 使用派生路径导入: 最后的key", JSON.stringify(key));
          dispatch(
            successImport({
              key,
            }),
          );
          resolve(key);
        });
      } catch (e) {
        dispatch(failedImport());
        reject(e);
      }
    });
  };

  /**
     * 使用此方法进行测试
     * @param decryptBackupText  公钥
     * @param opts 
     * @returns 
     */
  export const startImportFileTest =
  (decryptBackupText: string, opts: Partial<KeyOptions>): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          WALLET,
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();
        const tokenOpts = {
          ...BitpaySupportedTokenOpts,
          ...WALLET.tokenOptions,
          ...WALLET.customTokenOptions,
        };
        let {key: _key, wallet} = await createKeyAndCredentialsWithFileTest(
          decryptBackupText,
          opts,
        );
        // wallet.openWallet(async (err: Error) => {
        //   if (err) {
        //     if (err.message.indexOf('not found') > 0) {
        //       err = new Error('WALLET_DOES_NOT_EXIST');
        //     }
        //     return reject(err);
        //   }
        // });
        let wallets = [wallet];
        console.log('----------    文件导入: wallet, _key, opts', JSON.stringify(wallet), JSON.stringify(_key), JSON.stringify(opts));
        console.log('----------    文件导入: WALLET.keys', JSON.stringify(WALLET.keys));
        const matchedKey = _key.id ? getMatchedKey(_key, Object.values(WALLET.keys)) : getReadOnlyKey(Object.values(WALLET.keys));

        console.log('----------    文件导入: matchedKey', JSON.stringify(matchedKey));

        if (matchedKey && !opts?.keyId) {
          _key = matchedKey.methods;
          opts.keyId = null;
          if (isMatchedWallet(wallets[0], matchedKey.wallets)) {
            throw new Error(t('The wallet is already in the app.'));
          }
          wallets[0].keyId = matchedKey.id;
          wallets = wallets.concat(matchedKey.wallets);
        }

        // To clear encrypt password
        if (opts.keyId && matchedKey) {
          let filteredKeys = matchedKey.wallets.filter(
            w => w.credentials.walletId !== wallets[0].credentials.walletId,
          );
          filteredKeys.forEach(w => (w.credentials.keyId = w.keyId = _key.id));
          wallets = wallets.concat(filteredKeys);
          dispatch(deleteKey({keyId: opts.keyId}));
        }

        const key = buildKeyObj({
          key: _key,
          wallets: wallets.map(wallet => {
            // subscribe new wallet to push notifications
            if (notificationsAccepted) {
              dispatch(subscribePushNotifications(wallet, brazeEid!));
            }
            // subscribe new wallet to email notifications
            if (
              emailNotifications &&
              emailNotifications.accepted &&
              emailNotifications.email
            ) {
              const prefs = {
                email: emailNotifications.email,
                language: defaultLanguage,
                unit: 'btc', // deprecated
              };
              dispatch(subscribeEmailNotifications(wallet, prefs));
            }
            const {currencyAbbreviation, currencyName} = dispatch(
              mapAbbreviationAndName(
                wallet.credentials.coin,
                wallet.credentials.chain,
              ),
            );
            return merge(
              wallet,
              buildWalletObj(
                {...wallet.credentials, currencyAbbreviation, currencyName},
                tokenOpts,
              ),
            );
          }),
          backupComplete: true,
        });

        dispatch(
          successImport({
            key,
          }),
        );
        resolve(key);
      } catch (e) {
        dispatch(failedImport());
        reject(e);
      }
    });
  };

  /**
   * 公钥导入
   * @param importData 
   * @param opts 
   * @returns 
   */
  export const startImportPublicKey =
  (
    importData: {words?: string; xPrivKey?: string; xPublicKey?: string},
    opts: Partial<KeyOptions>,
  ): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log("---------- startImportPublicKey 使用公钥导入 参数: importData, opts", JSON.stringify(importData), JSON.stringify(opts));
        const {
          WALLET,
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();
        const tokenOpts = {
          ...BitpaySupportedTokenOpts,
          ...WALLET.tokenOptions,
          ...WALLET.customTokenOptions,
        };
        const {words, xPrivKey, xPublicKey} = importData;
        opts.mnemonic = words;
        opts.extendedPrivateKey = xPrivKey;
        opts.xPublicKey = xPublicKey;
        const showOpts = Object.assign({}, opts);
        if (showOpts.extendedPrivateKey) {
          showOpts.extendedPrivateKey = '[hidden]';
        }
        if (showOpts.mnemonic) {
          showOpts.mnemonic = '[hidden]';
        }
        dispatch(
          LogActions.info(
            `Importing Wallet with derivation path: ${JSON.stringify(
              showOpts,
            )}`,
          ),
        );
        console.log("---------- startImportPublicKey : 准备执行createKeyAndCredentials", JSON.stringify(opts));
        const data = await createKeyAndCredentials(opts);
        console.log("----------使用公钥导入: 执行完毕, 返回data", JSON.stringify(data));
        const {wallet, key: _key} = data;
        wallet.openWallet(async (err: Error) => {
          if (err) {
            if (err.message.indexOf('not found') > 0) {
              err = new Error('WALLET_DOES_NOT_EXIST');
            }
            return reject(err);
          }
          // subscribe new wallet to push notifications
          if (notificationsAccepted) {
            dispatch(subscribePushNotifications(wallet, brazeEid!));
          }
          // subscribe new wallet to email notifications
          if (
            emailNotifications &&
            emailNotifications.accepted &&
            emailNotifications.email
          ) {
            const prefs = {
              email: emailNotifications.email,
              language: defaultLanguage,
              unit: 'btc', // deprecated
            };
            dispatch(subscribeEmailNotifications(wallet, prefs));
          }
          const {currencyAbbreviation, currencyName} = dispatch(
            mapAbbreviationAndName(
              wallet.credentials.coin,
              wallet.credentials.chain,
            ),
          );
          console.log("---------- 使用公钥导入: WALLET", JSON.stringify(WALLET));
          let key;
          const matchedKey = getMatchedKey(_key, Object.values(WALLET.keys));
          console.log("---------- 使用公钥导入: matchedKey", JSON.stringify(matchedKey));
          console.log("---------- 使用公钥导入: currencyAbbreviation currencyName tokenOpts ", currencyAbbreviation, currencyName, JSON.stringify(tokenOpts));
          if (matchedKey) {
            return reject(new Error(t('Wallet already exists')));
            // To avoid duplicate key creation when importing
            // wallet.credentials.keyId = wallet.keyId = matchedKey.id;
            // key = await findKeyByKeyId(matchedKey.id, WALLET.keys);
            // key.wallets.push(
            //   merge(
            //     wallet,
            //     buildWalletObj(
            //       {
            //         ...wallet.credentials,
            //         currencyAbbreviation,
            //         currencyName,
            //       },
            //       tokenOpts,
            //     ),
            //   ),
            // );
            // console.log("---------- 使用公钥导入: if 最后的key ", JSON.stringify(key));
          } else {
            key = buildKeyObj({
              key: _key,
              wallets: [
                merge(
                  wallet,
                  buildWalletObj(
                    {...wallet.credentials, currencyAbbreviation, currencyName},
                    tokenOpts,
                  ),
                ),
              ],
              backupComplete: true,
            });
            console.log("---------- 使用公钥导入: else 最后的key ", JSON.stringify(key));
          }
          dispatch(
            successImport({
              key,
            }),
          );
          resolve(key);
        });
      } catch (e) {
        console.log("---------- 使用公钥导入导入: 出错了", e);
        dispatch(failedImport());
        reject(e);
      }
    });
  };





const createKeyAndCredentials = async (
  opts: Partial<KeyOptions>,
): Promise<any> => {
  let key: any;
  const coin = opts.coin as string;
  const network = opts.networkName || 'livenet';
  const account = opts.account || 0;
  const n = opts.n || 1;

  const bwcClient = BWC.getClient(undefined);
  console.log("---------- 准备创建 - 参数 opts: ", JSON.stringify(opts));
  if (opts.mnemonic) {
    try {
      opts.mnemonic = normalizeMnemonic(opts.mnemonic);
      // new BWC 8.23 api
      key = BWC.createKey({
        seedType: opts.cold ? 'cold': 'mnemonic',
        seedData: opts.mnemonic,
        useLegacyCoinType: opts.useLegacyCoinType,
        useLegacyPurpose: opts.useLegacyPurpose,
        passphrase: opts.passphrase,
        derivationPath: opts.cold ? opts.derivationPath : undefined,
        networkName: network,
      });

      bwcClient.fromString(
        key.createCredentials(undefined, {
          coin,
          chain: coin, // chain === coin for stored clients
          network,
          account,
          n,
        }),
      );
    } catch (e) {
      throw e;
    }
  } else if (opts.extendedPrivateKey) {
    try {
      key = BWC.createKey({
        seedType: 'extendedPrivateKey',
        seedData: opts.extendedPrivateKey,
        useLegacyCoinType: opts.useLegacyCoinType,
        useLegacyPurpose: opts.useLegacyPurpose,
      });

      bwcClient.fromString(
        key.createCredentials(undefined, {
          coin,
          chain: coin, // chain === coin for stored clients
          network,
          account,
          n,
        }),
      );
    } catch (e) {
      throw e;
    }
  } else if(opts.xPublicKey){
    try {
      key = BWC.createKey({
        seedType: 'extendedPublicKey',
        seedData: opts.xPublicKey,
        useLegacyCoinType: opts.useLegacyCoinType,
        useLegacyPurpose: opts.useLegacyPurpose,
      });
      console.log('---------- BWC key 创建成功: ', JSON.stringify(key));
      bwcClient.fromString(
        key.createCredentials(undefined, {
          coin,
          chain: coin, // chain === coin for stored clients
          network,
          account,
          n,
          xpub: opts.xPublicKey,
        }),
      );
      // 使用公钥创建只读钱包，需要把key移除，否则不会认定为read only
      key.id = null;
    } catch (e) {
      throw e;
    }
  } else {
    throw new Error(t('No data provided'));
  }
  let wallet;
  try {
    wallet = BWC.getClient(JSON.stringify(bwcClient.credentials));
    console.log('---------- wallet 创建成功: ', JSON.stringify(wallet));
  } catch (e) {
    throw e;
  }
  return Promise.resolve({wallet, key});
};


const createKeyAndCredentialsWithFile = async (
  decryptBackupText: string,
  opts: Partial<KeyOptions>,
): Promise<any> => {
  const bwcClient = BWC.getClient(undefined);
  let credentials;
  let key;
  let addressBook;
  const Key = BWC.getKey();

  const data = JSON.parse(decryptBackupText);
  if (data.credentials) {
    try {
      credentials = data.credentials;
      if (data.key) {
        key = new Key({
          seedType: 'object',
          seedData: data.key,
        });
      }
      addressBook = data.addressBook;
    } catch (err: any) {
      if (err && err.message === 'Bad Key version') {
        // Workaround for bad generated files. Fixed: https://github.com/bitpay/wallet/pull/11872
        data.key.version = '1';
        data.key.mnemonicHasPassphrase = false;
        key = new Key({
          seedType: 'object',
          seedData: data.key,
        });
      } else {
        throw new Error(t('New format. Could not import. Check input file.'));
      }
    }
  } else {
    // old format ? root = credentials.
    try {
      // needs to migrate?
      if (data.xPrivKey && data.xPrivKeyEncrypted) {
        // dispatch(
        //   LogActions.info(
        //     'Found both encrypted and decrypted key. Deleting the encrypted version',
        //   ),
        // );

        delete data.xPrivKeyEncrypted;
        delete data.mnemonicEncrypted;
      }

      let migrated = BWC.upgradeCredentialsV1(data);
      credentials = migrated.credentials;
      key = migrated.key;
      addressBook = data.addressBook ? data.addressBook : {};
    } catch (error) {
      throw new Error(t('Old format. Could not import. Check input file.'));
    }
  }

  if (!credentials.n) {
    throw new Error(
      t(
        'Backup format not recognized. If you are using a Copay Beta backup and version is older than 0.10, please see:',
      ) + ' https://github.com/bitpay/copay/issues/4730#issuecomment-244522614',
    );
  }

  bwcClient.fromString(JSON.stringify(credentials));

  if (key) {
    // dispatch(
    //   LogActions.info(
    //     `Wallet ${credentials.walletId} key's extracted`,
    //   ),
    // );
  } else {
    // dispatch(
    //   LogActions.info(
    //     `READ-ONLY Wallet ${credentials.walletId} migrated`,
    //   ),
    // );
  }

  // TODO SETMETADATA ADDRESSBOOK

  return Promise.resolve({wallet: bwcClient, key});
};


const createKeyAndCredentialsWithFileTest = async (
  decryptBackupText: string,
  opts: Partial<KeyOptions>,
): Promise<any> => {
  const bwcClient = BWC.getClient(undefined);
  // let credentials;
  let key;
  let addressBook;
  const Key = BWC.getKey();
  opts.name = 'Read Only';
  opts.xPublicKey = decryptBackupText;
  console.log('---------- createKeyAndCredentialsWithFileTest 导入之后 收到的参数 decryptBackupText', decryptBackupText);
  console.log('---------- createKeyAndCredentialsWithFileTest 导入之后 收到的参数 opts', JSON.stringify(opts));
  console.log('---------- createKeyAndCredentialsWithFileTest 导入之后 生成的Key', JSON.stringify(Key));
  
  const coin = opts.coin as string;
  const network = opts.networkName || 'livenet';
  const account = opts.account || 0;
  const n = opts.n || 1;

  console.log('---------- createKeyAndCredentialsWithFileTest 导入之后 收到的参数 useLegacyCoinType useLegacyPurpose', opts.useLegacyCoinType, opts.useLegacyPurpose);

  key = BWC.createKey({
    seedType: 'extendedPublicKey',
    seedData: opts.xPublicKey,
    useLegacyCoinType: opts.useLegacyCoinType,
    useLegacyPurpose: opts.useLegacyPurpose,
  });
  console.log('---------- BWC key 创建成功: ', JSON.stringify(key));

  bwcClient.fromString(
    key.createCredentials(undefined, {
      coin,
      chain: coin, // chain === coin for stored clients
      network,
      account,
      n,
      xpub: opts.xPublicKey
    }),
  );

  // 创建钱包 start
  bwcClient.createWallet(
    opts.name,
    opts.myName || 'me',
    opts.m || 1,
    opts.n || 1,
    {
      network: opts.networkName,
      singleAddress: opts.singleAddress,
      coin: opts.coin,
      useNativeSegwit: opts.useNativeSegwit,
    },
    (err: Error) => {
      if (err) {
        console.log('---------- 创建钱包时出错');
        throw new Error(err.message);
      } 
    },
  );
  // 创建钱包 end
  let wallet = await BWC.getClient(JSON.stringify(bwcClient.credentials));
  console.log('---------- 模拟凭据完毕， 输出 wallet : ', JSON.stringify(wallet));


  let {credentials} = wallet;
  delete credentials.keyId;
  key.id = null;

  const dataStr = JSON.stringify({credentials, addressBook: []});
  console.log('---------- 模拟凭据完毕， 输出 dataStr : ', dataStr);
  const data = JSON.parse(dataStr);

  if (data.credentials) {
    try {
      credentials = data.credentials;
      if (data.key) {
        key = new Key({
          seedType: 'object',
          seedData: data.key,
        });
      }
      addressBook = data.addressBook;
    } catch (err: any) {
      if (err && err.message === 'Bad Key version') {
        // Workaround for bad generated files. Fixed: https://github.com/bitpay/wallet/pull/11872
        data.key.version = '1';
        data.key.mnemonicHasPassphrase = false;
        key = new Key({
          seedType: 'object',
          seedData: data.key,
        });
        console.log('---------- createKeyAndCredentialsWithFile 导入之后 出现异常 data ， key', JSON.stringify(data), JSON.stringify(key));
      } else {
        throw new Error(t('New format. Could not import. Check input file.'));
      }
    }
  } else {
    // old format ? root = credentials.
    try {
      // needs to migrate?
      if (data.xPrivKey && data.xPrivKeyEncrypted) {
        // dispatch(
        //   LogActions.info(
        //     'Found both encrypted and decrypted key. Deleting the encrypted version',
        //   ),
        // );

        delete data.xPrivKeyEncrypted;
        delete data.mnemonicEncrypted;
      }

      let migrated = BWC.upgradeCredentialsV1(data);
      credentials = migrated.credentials;
      key = migrated.key;
      addressBook = data.addressBook ? data.addressBook : {};
    } catch (error) {
      throw new Error(t('Old format. Could not import. Check input file.'));
    }
  }

  if (!credentials.n) {
    throw new Error(
      t(
        'Backup format not recognized. If you are using a Copay Beta backup and version is older than 0.10, please see:',
      ) + ' https://github.com/bitpay/copay/issues/4730#issuecomment-244522614',
    );
  }

  bwcClient.fromString(JSON.stringify(credentials));

  if (key) {
    // dispatch(
    //   LogActions.info(
    //     `Wallet ${credentials.walletId} key's extracted`,
    //   ),
    // );
  } else {
    // dispatch(
    //   LogActions.info(
    //     `READ-ONLY Wallet ${credentials.walletId} migrated`,
    //   ),
    // );
  }

  // TODO SETMETADATA ADDRESSBOOK
  console.log('---------- createKeyAndCredentialsWithFile 导入之后 最终的key', JSON.stringify(key));
  console.log('---------- createKeyAndCredentialsWithFile 导入之后 最终的credentials', JSON.stringify(credentials));
  console.log('---------- createKeyAndCredentialsWithFile 导入之后 最终的bwcClient', JSON.stringify(bwcClient));
  return Promise.resolve({wallet: bwcClient, key});
};

export const serverAssistedImport = async (
  opts: Partial<KeyOptions>,
): Promise<{key: KeyMethods; wallets: Wallet[]}> => {
  return new Promise((resolve, reject) => {
    try {
      BwcProvider.API.serverAssistedImport(
        opts,
        {
          baseUrl: 'https://bws.bitpay.com/bws/api'
          // baseUrl: 'http://10.100.201.52:3232/bws/api'
        }, // 'http://localhost:3232/bws/api', uncomment for local testing
        // @ts-ignore
        async (err, key, wallets) => {
          if (err) {
            return reject(err);
          }
          if (wallets.length === 0) {
            return reject(new Error('WALLET_DOES_NOT_EXIST'));
          } else {
            const tokens: Wallet[] = wallets.filter(
              (wallet: Wallet) => !!wallet.credentials.token,
            );

            if (tokens && !!tokens.length) {
              wallets = linkTokenToWallet(tokens, wallets);
            }

            return resolve({key, wallets});
          }
        },
      );
    } catch (err) {
      return reject(err);
    }
  });
};
const linkTokenToWallet = (tokens: Wallet[], wallets: Wallet[]) => {
  tokens.forEach(token => {
    // find the associated wallet to add tokens too
    const associatedWalletId = token.credentials.walletId.split('-0x')[0];
    wallets = wallets.map((wallet: Wallet) => {
      if (wallet.credentials.walletId === associatedWalletId) {
        // push token walletId as reference - this is used later to build out nested overview lists
        wallet.tokens = wallet.tokens || [];
        wallet.tokens.push(token.credentials.walletId);
      }
      return wallet;
    });
  });

  return wallets;
};
