import {Effect} from '../../../index';
import {BwcProvider} from '../../../../lib/bwc';
import merge from 'lodash.merge';
import {
  buildKeyObj,
  buildWalletObj,
  mapAbbreviationAndName,
} from '../../utils/wallet';
import {successCreateKey, successAddWallet} from '../../wallet.actions';
import API from 'bitcore-wallet-client/ts_build';
import {Key, KeyMethods, KeyOptions, Wallet} from '../../wallet.models';
import {
  subscribePushNotifications,
  subscribeEmailNotifications,
} from '../../../app/app.effects';
import {t} from 'i18next';
import {setExpectedKeyLengthChange} from '../../../app/app.actions';
import {batch} from 'react-redux';

const BWC = BwcProvider.getInstance();

export const startJoinMultisig =
  (opts: Partial<KeyOptions>): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
          WALLET: {keys},
        } = getState();
        const walletData = BWC.parseSecret(opts.invitationCode as string);
        // console.log('---------- 加入共享钱包 - 对方创建的多签钱包信息', JSON.stringify(walletData));
        opts.networkName = walletData.network;
        opts.coin = walletData.coin;
        /* TODO: opts.n is just used to determinate if the wallet is multisig (m/48'/xx) or single sig (m/44')
        we should change the name to 'isMultisig'
       */
        opts.n = 2;

        // TODO check if exist

        const _key = BWC.createKey({
          seedType: 'new',
        });

        const _wallet = await joinMultisigWallet({key: _key, opts});

        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(_wallet, brazeEid!));
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
          dispatch(subscribeEmailNotifications(_wallet, prefs));
        }
        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            _wallet.credentials.coin,
            _wallet.credentials.chain,
          ),
        );

        // build out app specific props
        const wallet = merge(
          _wallet,
          buildWalletObj({
            ..._wallet.credentials,
            currencyAbbreviation,
            currencyName,
          }),
        ) as Wallet;

        const key = buildKeyObj({key: _key, wallets: [wallet]});
        const previousKeysLength = Object.keys(keys).length;
        const numNewKeys = Object.keys(keys).length + 1;
        const expectedLengthChange = previousKeysLength - numNewKeys;
        batch(() => {
          dispatch(
            successCreateKey({
              key,
            }),
          );
          dispatch(setExpectedKeyLengthChange(expectedLengthChange));
        });
        resolve(key);
      } catch (err) {
        reject(err);
      }
    });
  };



  export const startJoinReadonlyMultisig =
  (opts: Partial<KeyOptions>): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
          WALLET: {keys},
        } = getState();
        const walletData = BWC.parseSecret(opts.invitationCode as string);
        // console.log('---------- 加入共享钱包 - 对方创建的多签钱包信息', JSON.stringify(walletData));
        opts.networkName = walletData.network;
        opts.coin = walletData.coin;
        /* TODO: opts.n is just used to determinate if the wallet is multisig (m/48'/xx) or single sig (m/44')
        we should change the name to 'isMultisig'
       */
        opts.n = 2;

        // TODO check if exist

        // 模拟数据初始化
        opts.useLegacyCoinType = true;
        opts.useLegacyPurpose = true;
        const _key = BWC.createKey({
          seedType: 'extendedPublicKey',
          seedData: opts.extendedPublicKey,
          useLegacyCoinType: opts.useLegacyCoinType,
          useLegacyPurpose: opts.useLegacyPurpose,
        });

        const _wallet = await joinMultisigWallet({key: _key, opts});

        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(_wallet, brazeEid!));
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
          dispatch(subscribeEmailNotifications(_wallet, prefs));
        }
        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            _wallet.credentials.coin,
            _wallet.credentials.chain,
          ),
        );

        // build out app specific props
        const wallet = merge(
          _wallet,
          buildWalletObj({
            ..._wallet.credentials,
            currencyAbbreviation,
            currencyName,
          }),
        ) as Wallet;

        const key = buildKeyObj({key: _key, wallets: [wallet], backupComplete: true});
        const previousKeysLength = Object.keys(keys).length;
        const numNewKeys = Object.keys(keys).length + 1;
        const expectedLengthChange = previousKeysLength - numNewKeys;
        batch(() => {
          dispatch(
            successCreateKey({
              key,
            }),
          );
          dispatch(setExpectedKeyLengthChange(expectedLengthChange));
        });
        resolve(key);
      } catch (err) {
        reject(err);
      }
    });
  };



  /**
   * 创建新的钱包或者打开原有的钱包，并且加入到多签钱包中
   * @param opts 
   * @returns 
   */
  export const startCreateOrOpenJoinReadonlyMultisig =
  (opts: Partial<KeyOptions>): Effect =>
  async (dispatch, getState): Promise<Key> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
          WALLET: {keys},
        } = getState();
        const walletData = BWC.parseSecret(opts.invitationCode as string);
        // console.log('---------- 加入共享钱包 - 对方创建的多签钱包信息', JSON.stringify(walletData));
        opts.networkName = walletData.network;
        opts.coin = walletData.coin;
        /* TODO: opts.n is just used to determinate if the wallet is multisig (m/48'/xx) or single sig (m/44')
        we should change the name to 'isMultisig'
       */
        opts.n = 2;

        // TODO check if exist

        // 模拟数据初始化
        opts.useLegacyCoinType = true;
        opts.useLegacyPurpose = true;
        const _key = BWC.createKey({
          seedType: 'extendedPublicKey',
          seedData: opts.extendedPublicKey,
          useLegacyCoinType: opts.useLegacyCoinType,
          useLegacyPurpose: opts.useLegacyPurpose,
        });

        // const _wallet = await joinMultisigWallet({key: _key, opts});
        const _wallet = await joinCreateOrOpenMultisigWallet({key: _key, opts});
        console.log(`---------- 多签 加入钱包 startCreateOrOpenJoinReadonlyMultisig 已经获取到 _wallet = [${JSON.stringify(_wallet)}]`);


        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(_wallet, brazeEid!));
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
          dispatch(subscribeEmailNotifications(_wallet, prefs));
        }
        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            _wallet.credentials.coin,
            _wallet.credentials.chain,
          ),
        );

        // build out app specific props
        const wallet = merge(
          _wallet,
          buildWalletObj({
            ..._wallet.credentials,
            currencyAbbreviation,
            currencyName,
          }),
        ) as Wallet;

        const key = buildKeyObj({key: _key, wallets: [wallet], backupComplete: true});
        const previousKeysLength = Object.keys(keys).length;
        const numNewKeys = Object.keys(keys).length + 1;
        const expectedLengthChange = previousKeysLength - numNewKeys;
        batch(() => {
          dispatch(
            successCreateKey({
              key,
            }),
          );
          dispatch(setExpectedKeyLengthChange(expectedLengthChange));
        });
        resolve(key);
      } catch (err) {
        reject(err);
      }
    });
  };

export const addWalletJoinMultisig =
  ({key, opts}: {key: Key; opts: Partial<KeyOptions>}): Effect =>
  async (dispatch, getState): Promise<Wallet> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();

        const walletData = BWC.parseSecret(opts.invitationCode as string);
        opts.networkName = walletData.network;
        opts.coin = walletData.coin;
        /* TODO: opts.n is just used to determinate if the wallet is multisig (m/48'/xx) or single sig (m/44')
        we should change the name to 'isMultisig'
       */
        opts.n = 2;
        const newWallet = (await joinMultisigWallet({
          key: key.methods!,
          opts,
        })) as Wallet;

        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(newWallet, brazeEid!));
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
          dispatch(subscribeEmailNotifications(newWallet, prefs));
        }

        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            newWallet.credentials.coin,
            newWallet.credentials.chain,
          ),
        );

        key.wallets.push(
          merge(
            newWallet,
            buildWalletObj({
              ...newWallet.credentials,
              currencyAbbreviation,
              currencyName,
            }),
          ) as Wallet,
        );

        dispatch(successAddWallet({key}));

        resolve(newWallet);
      } catch (err) {
        reject(err);
      }
    });
  };


  export const addWalletJoinReadonlyMultisig =
  ({key, opts}: {key: Key; opts: Partial<KeyOptions>}): Effect =>
  async (dispatch, getState): Promise<Wallet> => {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          APP: {
            notificationsAccepted,
            emailNotifications,
            brazeEid,
            defaultLanguage,
          },
        } = getState();

        const walletData = BWC.parseSecret(opts.invitationCode as string);
        // console.log('---------- 加入共享钱包  addWalletJoinReadonlyMultisig   walletData = ', JSON.stringify(walletData));
        opts.networkName = walletData.network;
        opts.coin = walletData.coin;
        /* TODO: opts.n is just used to determinate if the wallet is multisig (m/48'/xx) or single sig (m/44')
        we should change the name to 'isMultisig'
       */
        opts.n = 2;
        const newWallet = (await joinMultisigReadonlyWallet({
          key: key.methods!,
          opts,
        })) as Wallet;
        // console.log('---------- 加入共享钱包 新钱包创建完毕  addWalletJoinReadonlyMultisig   newWallet = ', JSON.stringify(newWallet));
        // subscribe new wallet to push notifications
        if (notificationsAccepted) {
          dispatch(subscribePushNotifications(newWallet, brazeEid!));
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
          dispatch(subscribeEmailNotifications(newWallet, prefs));
        }

        const {currencyAbbreviation, currencyName} = dispatch(
          mapAbbreviationAndName(
            newWallet.credentials.coin,
            newWallet.credentials.chain,
          ),
        );

        key.wallets.push(
          merge(
            newWallet,
            buildWalletObj({
              ...newWallet.credentials,
              currencyAbbreviation,
              currencyName,
            }),
          ) as Wallet,
        );

        dispatch(successAddWallet({key}));

        resolve(newWallet);
      } catch (err) {
        reject(err);
      }
    });
  };

const joinMultisigReadonlyWallet = (params: {
  key: KeyMethods;
  opts: Partial<KeyOptions>;
}): Promise<API> => {
  return new Promise((resolve, reject) => {
    try {
      const bwcClient = BWC.getClient();
      const {key, opts} = params;
      // console.log('---------- 加入共享钱包 新钱包创建完毕  addWalletJoinReadonlyMultisig   key.id = ', JSON.stringify(key.id));
      // TODO 必须是通过公钥创建的只读钱包， 用这个钱包创建的只读多签钱包才可以走此方法。
      if(!key.id.startsWith('readonly-')){
        new Error(
          t(
            'Must be a read-only wallet created with a public key to create a read-only multi-signature wallet',
          ),
        )         
      }
      // 下标为1，则是公钥
      const arr = key.id.split('-');
      if(arr?.length !== 2){
        new Error(
          t(
            'Must be a read-only wallet created with a public key to create a read-only multi-signature wallet',
          ),
        )   
      }

      bwcClient.fromString(
        key.createCredentials(opts.password, {
          coin: opts.coin,
          chain: opts.coin, // chain === coin for stored clients
          network: opts.networkName,
          account: opts.account || 0,
          n: opts.n,
          xpub: arr[1],
        }),
      );

      bwcClient.joinWallet(
        opts.invitationCode,
        opts.myName,
        {
          coin: opts.coin,
        },
        (err: Error) => {
          if (err) {
            switch (err.name) {
              case 'bwc.ErrorCOPAYER_REGISTERED': {
                const account = opts.account || 0;
                if (account >= 20) {
                  return reject(
                    new Error(
                      t(
                        '20 Wallet limit from the same coin and network has been reached.',
                      ),
                    ),
                  );
                }
                return resolve(
                  joinMultisigReadonlyWallet({
                    key,
                    opts: {...opts, account: account + 1},
                  }),
                );
              }
            }

            return reject(err);
          } else {
            return resolve(bwcClient);
          }
        },
      );
    } catch (err) {
      reject(err);
    }
  });
};


const joinMultisigWallet = (params: {
  key: KeyMethods;
  opts: Partial<KeyOptions>;
}): Promise<API> => {
  return new Promise((resolve, reject) => {
    try {
      const bwcClient = BWC.getClient();
      const {key, opts} = params;

      bwcClient.fromString(
        key.createCredentials(opts.password, {
          coin: opts.coin,
          chain: opts.coin, // chain === coin for stored clients
          network: opts.networkName,
          account: opts.account || 0,
          n: opts.n,
          xpub: opts.extendedPublicKey || '',
        }),
      );

      bwcClient.joinWallet(
        opts.invitationCode,
        opts.myName,
        {
          coin: opts.coin,
        },
        (err: Error) => {
          if (err) {
            switch (err.name) {
              case 'bwc.ErrorCOPAYER_REGISTERED': {
                const account = opts.account || 0;
                if (account >= 20) {
                  return reject(
                    new Error(
                      t(
                        '20 Wallet limit from the same coin and network has been reached.',
                      ),
                    ),
                  );
                }
                return resolve(
                  joinMultisigWallet({
                    key,
                    opts: {...opts, account: account + 1},
                  }),
                );
              }
            }

            return reject(err);
          } else {
            return resolve(bwcClient);
          }
        },
      );
    } catch (err) {
      reject(err);
    }
  });
};



/**
 * 如果钱包存在，则使用原有的钱包，如果钱包不存在，则先创建钱包，再加入钱包
 * @param params 
 * @returns 
 */
const joinCreateOrOpenMultisigWallet = (params: {
  key: KeyMethods;
  opts: Partial<KeyOptions>;
}): Promise<API> => {
  return new Promise((resolve, reject) => {
    try {
      const bwcClient = BWC.getClient();
      const {key, opts} = params;

      bwcClient.fromString(
        key.createCredentials(opts.password, {
          coin: opts.coin,
          chain: opts.coin, // chain === coin for stored clients
          network: opts.networkName,
          account: opts.account || 0,
          n: opts.n,
          xpub: opts.extendedPublicKey || '',
        }),
      );
      let wallet: any;

      wallet = BWC.getClient(JSON.stringify(bwcClient.credentials));
      console.log(`---------- 多签 加入钱包 joinCreateOrOpenMultisigWallet 开启钱包之前 wallet = [${JSON.stringify(wallet)}]`);

      wallet.openWallet(async (err: Error) => {
        if (err) {
          console.log(`---------- 多签 加入钱包 joinCreateOrOpenMultisigWallet 开启钱包失败 err = [${JSON.stringify(err)}]`);
          if (err.message.indexOf('not found') > 0) {
            // 未找到钱包， 需要进行创建钱包
            console.log(`---------- 多签 加入钱包 joinCreateOrOpenMultisigWallet 准备开始创建钱包 opts = [${JSON.stringify(opts)}]`);
            bwcClient.joinWallet(
              opts.invitationCode,
              opts.myName,
              {
                coin: opts.coin,
              },
              (err: Error) => {
                if (err) {
                  switch (err.name) {
                    case 'bwc.ErrorCOPAYER_REGISTERED': {
                      return reject(
                        new Error('Error COPAYER REGISTERED'),
                      );
                    }
                  }
                  return reject(err);
                } else {
                  return resolve(bwcClient);
                }
              },
            );
          } else {
            reject(err);
          }
        } else {
          console.log(`---------- 多签 加入钱包 joinCreateOrOpenMultisigWallet 开启钱包成功 直接返回钱包 wallet = [${JSON.stringify(wallet)}]`);
          resolve(wallet);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};
