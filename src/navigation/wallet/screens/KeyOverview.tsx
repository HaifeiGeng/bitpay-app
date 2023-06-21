import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
  useTheme,
} from '@react-navigation/native';
import {FlatList, LogBox, RefreshControl, TouchableOpacity} from 'react-native';
import styled from 'styled-components/native';
import haptic from '../../../components/haptic-feedback/haptic';
import WalletRow, {WalletRowProps} from '../../../components/list/WalletRow';
import {
  BaseText,
  H2,
  H5,
  HeaderTitle,
  ProposalBadge,
} from '../../../components/styled/Text';
import Settings from '../../../components/settings/Settings';
import {
  Hr,
  ActiveOpacity,
  ScreenGutter,
  HeaderRightContainer as _HeaderRightContainer,
  ProposalBadgeContainer,
} from '../../../components/styled/Containers';
import {showBottomNotificationModal} from '../../../store/app/app.actions';
import {startUpdateAllWalletStatusForKey} from '../../../store/wallet/effects/status/status';
import {
  toggleHideKeyBalance,
  updatePortfolioBalance,
} from '../../../store/wallet/wallet.actions';
import {Wallet, Status} from '../../../store/wallet/wallet.models';
import {Rates} from '../../../store/rate/rate.models';
import {
  LightBlack,
  NeutralSlate,
  SlateDark,
  White,
} from '../../../styles/colors';
import {
  convertToFiat,
  formatFiatAmount,
  shouldScale,
  sleep,
} from '../../../utils/helper-methods';
import {BalanceUpdateError} from '../components/ErrorMessages';
import OptionsSheet, {Option} from '../components/OptionsSheet';
import Icons from '../components/WalletIcons';
import {WalletStackParamList} from '../WalletStack';
import ChevronDownSvg from '../../../../assets/img/chevron-down.svg';
import {
  AppDispatch,
  useAppDispatch,
  useAppSelector,
  useLogger,
} from '../../../utils/hooks';
import SheetModal from '../../../components/modal/base/sheet/SheetModal';
import KeyDropdownOption from '../components/KeyDropdownOption';
import {getPriceHistory, startGetRates} from '../../../store/wallet/effects';
import EncryptPasswordImg from '../../../../assets/img/tinyicon-encrypt.svg';
import EncryptPasswordDarkModeImg from '../../../../assets/img/tinyicon-encrypt-darkmode.svg';
import {useTranslation} from 'react-i18next';
import {toFiat} from '../../../store/wallet/utils/wallet';
import _ from 'lodash';
import {COINBASE_ENV} from '../../../api/coinbase/coinbase.constants';
import CoinbaseDropdownOption from '../components/CoinbaseDropdownOption';
import {Analytics} from '../../../store/analytics/analytics.effects';

import { ethers } from "ethers";

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const Row = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: flex-end;
`;

const OverviewContainer = styled.View`
  flex: 1;
`;

const BalanceContainer = styled.View`
  height: 15%;
  margin-top: 20px;
  padding: 10px 15px;
`;

const Balance = styled(BaseText)<{scale: boolean}>`
  font-size: ${({scale}) => (scale ? 25 : 35)}px;
  font-style: normal;
  font-weight: 700;
  line-height: 53px;
  letter-spacing: 0;
  text-align: center;
`;

const WalletListHeader = styled.View`
  padding: 10px;
  margin-top: 10px;
`;

const WalletListFooter = styled.TouchableOpacity`
  padding: 10px 10px 100px 10px;
  margin-top: 15px;
  flex-direction: row;
  align-items: center;
`;

const WalletListFooterText = styled(BaseText)`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  letter-spacing: 0;
  margin-left: 10px;
`;

export const KeyToggle = styled(TouchableOpacity)`
  align-items: center;
  flex-direction: column;
`;

export const KeyDropdown = styled.SafeAreaView`
  background: ${({theme: {dark}}) => (dark ? LightBlack : White)};
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  max-height: 75%;
`;

export const KeyDropdownOptionsContainer = styled.ScrollView`
  padding: 0 ${ScreenGutter};
`;

const CogIconContainer = styled.TouchableOpacity`
  background-color: ${({theme: {dark}}) => (dark ? LightBlack : NeutralSlate)};
  border-radius: 50px;
  justify-content: center;
  align-items: center;
  height: 40px;
  width: 40px;
`;

const HeaderTitleContainer = styled.View`
  flex-direction: row;
  align-items: center;
`;

const HeaderRightContainer = styled(_HeaderRightContainer)`
  flex-direction: row;
  align-items: center;
`;


//#region 
// export const buildUIFormattedWallet: (
//   wallet: Wallet,
//   defaultAltCurrencyIsoCode: string,
//   rates: Rates,
//   dispatch: AppDispatch,
//   currencyDisplay?: 'symbol',
// ) => WalletRowProps = (
//   {
//     id,
//     img,
//     badgeImg,
//     currencyName,
//     currencyAbbreviation,
//     chain,
//     network,
//     walletName,
//     balance,
//     credentials,
//     keyId,
//     isRefreshing,
//     hideWallet,
//     hideBalance,
//     pendingTxps,
//   },
//   defaultAltCurrencyIsoCode,
//   rates,
//   dispatch,
//   currencyDisplay,
// ) => ({
//   id,
//   keyId,
//   img,
//   badgeImg,
//   currencyName,
//   currencyAbbreviation: currencyAbbreviation.toUpperCase(),
//   chain,
//   walletName: walletName || credentials.walletName,
//   cryptoBalance: balance.crypto,
//   cryptoLockedBalance: balance.cryptoLocked,
//   cryptoConfirmedLockedBalance: balance.cryptoConfirmedLocked,
//   cryptoSpendableBalance: balance.cryptoSpendable,
//   cryptoPendingBalance: balance.cryptoPending,
//   fiatBalance: formatFiatAmount(
//     convertToFiat(
//       dispatch(
//         toFiat(
//           balance.sat,
//           defaultAltCurrencyIsoCode,
//           currencyAbbreviation,
//           chain,
//           rates,
//         ),
//       ),
//       hideWallet,
//       network,
//     ),
//     defaultAltCurrencyIsoCode,
//     {
//       currencyDisplay,
//     },
//   ),
//   fiatLockedBalance: formatFiatAmount(
//     convertToFiat(
//       dispatch(
//         toFiat(
//           balance.satLocked,
//           defaultAltCurrencyIsoCode,
//           currencyAbbreviation,
//           chain,
//           rates,
//         ),
//       ),
//       hideWallet,
//       network,
//     ),
//     defaultAltCurrencyIsoCode,
//     {
//       currencyDisplay,
//     },
//   ),
//   fiatConfirmedLockedBalance: formatFiatAmount(
//     convertToFiat(
//       dispatch(
//         toFiat(
//           balance.satConfirmedLocked,
//           defaultAltCurrencyIsoCode,
//           currencyAbbreviation,
//           chain,
//           rates,
//         ),
//       ),
//       hideWallet,
//       network,
//     ),
//     defaultAltCurrencyIsoCode,
//     {
//       currencyDisplay,
//     },
//   ),
//   fiatSpendableBalance: formatFiatAmount(
//     convertToFiat(
//       dispatch(
//         toFiat(
//           balance.satSpendable,
//           defaultAltCurrencyIsoCode,
//           currencyAbbreviation,
//           chain,
//           rates,
//         ),
//       ),
//       hideWallet,
//       network,
//     ),
//     defaultAltCurrencyIsoCode,
//     {
//       currencyDisplay,
//     },
//   ),
//   fiatPendingBalance: formatFiatAmount(
//     convertToFiat(
//       dispatch(
//         toFiat(
//           balance.satPending,
//           defaultAltCurrencyIsoCode,
//           currencyAbbreviation,
//           chain,
//           rates,
//         ),
//       ),
//       hideWallet,
//       network,
//     ),
//     defaultAltCurrencyIsoCode,
//     {
//       currencyDisplay,
//     },
//   ),
//   network: network,
//   isRefreshing,
//   hideWallet,
//   hideBalance,
//   pendingTxps,
//   multisig:
//     credentials.n > 1
//       ? `- Multisig ${credentials.m}/${credentials.n}`
//       : undefined,
// });
//#endregion

export const buildUIFormattedWallet: (
  wallet: Wallet,
  defaultAltCurrencyIsoCode: string,
  rates: Rates,
  dispatch: AppDispatch,
  currencyDisplay?: 'symbol',
) => WalletRowProps = (
  // {
  //   id,
  //   img,
  //   badgeImg,
  //   currencyName,
  //   currencyAbbreviation,
  //   chain,
  //   network,
  //   walletName,
  //   balance,
  //   credentials,
  //   keyId,
  //   isRefreshing,
  //   hideWallet,
  //   hideBalance,
  //   pendingTxps,
  // },
  wallet,
  defaultAltCurrencyIsoCode,
  rates,
  dispatch,
  currencyDisplay,
) => ({
  id: wallet.id,
  keyId: wallet.keyId,
  img: wallet.img,
  badgeImg: wallet.badgeImg,
  currencyName: wallet.currencyName,
  currencyAbbreviation: wallet.currencyAbbreviation.toUpperCase(),
  chain: wallet.chain,
  walletName: wallet.walletName || wallet.credentials.walletName,
  cryptoBalance: wallet.balance.crypto,
  cryptoLockedBalance: wallet.balance.cryptoLocked,
  cryptoConfirmedLockedBalance: wallet.balance.cryptoConfirmedLocked,
  cryptoSpendableBalance: wallet.balance.cryptoSpendable,
  cryptoPendingBalance: wallet.balance.cryptoPending,
  fiatBalance: formatFiatAmount(
    convertToFiat(
      dispatch(
        toFiat(
          wallet.balance.sat,
          defaultAltCurrencyIsoCode,
          wallet.currencyAbbreviation,
          wallet.chain,
          rates,
        ),
      ),
      wallet.hideWallet,
      wallet.network,
    ),
    defaultAltCurrencyIsoCode,
    {
      currencyDisplay,
    },
  ),
  fiatLockedBalance: formatFiatAmount(
    convertToFiat(
      dispatch(
        toFiat(
          wallet.balance.satLocked,
          defaultAltCurrencyIsoCode,
          wallet.currencyAbbreviation,
          wallet.chain,
          rates,
        ),
      ),
      wallet.hideWallet,
      wallet.network,
    ),
    defaultAltCurrencyIsoCode,
    {
      currencyDisplay,
    },
  ),
  fiatConfirmedLockedBalance: formatFiatAmount(
    convertToFiat(
      dispatch(
        toFiat(
          wallet.balance.satConfirmedLocked,
          defaultAltCurrencyIsoCode,
          wallet.currencyAbbreviation,
          wallet.chain,
          rates,
        ),
      ),
      wallet.hideWallet,
      wallet.network,
    ),
    defaultAltCurrencyIsoCode,
    {
      currencyDisplay,
    },
  ),
  fiatSpendableBalance: formatFiatAmount(
    convertToFiat(
      dispatch(
        toFiat(
          wallet.balance.satSpendable,
          defaultAltCurrencyIsoCode,
          wallet.currencyAbbreviation,
          wallet.chain,
          rates,
        ),
      ),
      wallet.hideWallet,
      wallet.network,
    ),
    defaultAltCurrencyIsoCode,
    {
      currencyDisplay,
    },
  ),
  fiatPendingBalance: formatFiatAmount(
    convertToFiat(
      dispatch(
        toFiat(
          wallet.balance.satPending,
          defaultAltCurrencyIsoCode,
          wallet.currencyAbbreviation,
          wallet.chain,
          rates,
        ),
      ),
      wallet.hideWallet,
      wallet.network,
    ),
    defaultAltCurrencyIsoCode,
    {
      currencyDisplay,
    },
  ),
  network: wallet.network,
  isRefreshing: wallet.isRefreshing,
  hideWallet: wallet.hideWallet,
  hideBalance: wallet.hideBalance,
  pendingTxps: wallet.pendingTxps,
  multisig:
    wallet.credentials.n > 1
      ? `- Multisig ${wallet.credentials.m}/${wallet.credentials.n}`
      : undefined,
  currentWallet: wallet,
});

// Key overview list builder
export const buildNestedWalletList = (
  coins: Wallet[],
  tokens: Wallet[],
  defaultAltCurrencyIso: string,
  rates: Rates,
  dispatch: AppDispatch,
) => {
  const walletList = [] as Array<WalletRowProps>;

  coins.forEach(coin => {
    walletList.push({
      ...buildUIFormattedWallet(coin, defaultAltCurrencyIso, rates, dispatch),
    });
    // eth wallet with tokens -> for every token wallet ID grab full wallet from _tokens and add it to the list
    if (coin.tokens) {
      coin.tokens.forEach(id => {
        const tokenWallet = tokens.find(token => token.id === id);
        if (tokenWallet) {
          walletList.push({
            ...buildUIFormattedWallet(
              tokenWallet,
              defaultAltCurrencyIso,
              rates,
              dispatch,
            ),
            isToken: true,
          });
        }
      });
    }
  });

  return walletList;
};

/**
   * 获取Token ontract
   * @param network string 当前网络
   * @param tokenAddress string 代币地址
   * @param currencyAbbreviation string 货币缩写
   * @returns 
   */
export const getTokenContract = (network: string, tokenAddress: string, currencyAbbreviation: string, abi: any) => {
  console.log(`----------  WalletRow中 当前token获取合约对象, 入参: network = [${network}]  tokenAddress = [${tokenAddress}]  currencyAbbreviation = [${currencyAbbreviation}]    `);
  const provider = new ethers.providers.EtherscanProvider(network === 'livenet' ? 'homestead' : network, ETHERSCAN_API_KEY);
  return new ethers.Contract(tokenAddress, abi, provider);
}


export const ETHERSCAN_API_KEY = '583ED82X4PFCBG6RFZYFGH9TZI5QF3SP1F';
export const INFURA_API_KEY = '7dc74fd8880c433ea68f136756979dc2';
export const USDT_USDC_ABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_upgradedAddress","type":"address"}],"name":"deprecate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"deprecated","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_evilUser","type":"address"}],"name":"addBlackList","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"upgradedAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balances","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"maximumFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_maker","type":"address"}],"name":"getBlackListStatus","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowed","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"who","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newBasisPoints","type":"uint256"},{"name":"newMaxFee","type":"uint256"}],"name":"setParams","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"issue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"redeem","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"basisPointsRate","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isBlackListed","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_clearedUser","type":"address"}],"name":"removeBlackList","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"MAX_UINT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_blackListedUser","type":"address"}],"name":"destroyBlackFunds","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_initialSupply","type":"uint256"},{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"name":"amount","type":"uint256"}],"name":"Issue","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"amount","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"newAddress","type":"address"}],"name":"Deprecate","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"feeBasisPoints","type":"uint256"},{"indexed":false,"name":"maxFee","type":"uint256"}],"name":"Params","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_blackListedUser","type":"address"},{"indexed":false,"name":"_balance","type":"uint256"}],"name":"DestroyedBlackFunds","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_user","type":"address"}],"name":"AddedBlackList","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_user","type":"address"}],"name":"RemovedBlackList","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[],"name":"Pause","type":"event"},{"anonymous":false,"inputs":[],"name":"Unpause","type":"event"}];

const KeyOverview = () => {
  const {t} = useTranslation();
  const {
    params: {id, context},
  } = useRoute<RouteProp<WalletStackParamList, 'KeyOverview'>>();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const logger = useLogger();
  const theme = useTheme();
  const [showKeyOptions, setShowKeyOptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const {keys} = useAppSelector(({WALLET}) => WALLET);
  const {rates} = useAppSelector(({RATE}) => RATE);
  const defaultAltCurrency = useAppSelector(({APP}) => APP.defaultAltCurrency);
  const linkedCoinbase = useAppSelector(
    ({COINBASE}) => !!COINBASE.token[COINBASE_ENV],
  );
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const key = keys[id];
  const hasMultipleKeys =
    Object.values(keys).filter(k => k.backupComplete).length > 1;
  let pendingTxps: any = [];
  _.each(key?.wallets, x => {
    if (x.pendingTxps) {
      pendingTxps = pendingTxps.concat(x.pendingTxps);
    }
  });
  useLayoutEffect(() => {
    if (!key) {
      return;
    }

    navigation.setOptions({
      headerTitle: () => {
        return (
          <KeyToggle
            activeOpacity={ActiveOpacity}
            disabled={!hasMultipleKeys && !linkedCoinbase}
            onPress={() => setShowKeyDropdown(true)}>
            {key.methods?.isPrivKeyEncrypted() ? (
              theme.dark ? (
                <EncryptPasswordDarkModeImg />
              ) : (
                <EncryptPasswordImg />
              )
            ) : null}
            <HeaderTitleContainer>
              <HeaderTitle style={{textAlign: 'center'}}>
                {key?.keyName}
              </HeaderTitle>
              {(hasMultipleKeys || linkedCoinbase) && (
                <ChevronDownSvg style={{marginLeft: 10}} />
              )}
            </HeaderTitleContainer>
          </KeyToggle>
        );
      },
      headerRight: () => {
        return (
          <>
            <HeaderRightContainer>
              {pendingTxps.length ? (
                <ProposalBadgeContainer
                  style={{marginRight: 10}}
                  onPress={onPressTxpBadge}>
                  <ProposalBadge>{pendingTxps.length}</ProposalBadge>
                </ProposalBadgeContainer>
              ) : null}
              {key?.methods?.isPrivKeyEncrypted() ? (
                <CogIconContainer
                  onPress={() =>
                    navigation.navigate('Wallet', {
                      screen: 'KeySettings',
                      params: {
                        key,
                      },
                    })
                  }
                  activeOpacity={ActiveOpacity}>
                  <Icons.Cog />
                </CogIconContainer>
              ) : (
                <>
                  <Settings
                    onPress={() => {
                      setShowKeyOptions(true);
                    }}
                  />
                </>
              )}
            </HeaderRightContainer>
          </>
        );
      },
    });
  }, [navigation, key, hasMultipleKeys, theme.dark]);

  useEffect(() => {
    if (context === 'createNewMultisigKey') {
      // console.log(`---------- 多签创建完毕后 `);
      key?.wallets[0].getStatus(
        {network: key?.wallets[0].network},
        (err: any, status: Status) => {
          if (err) {
            const errStr =
              err instanceof Error ? err.message : JSON.stringify(err);
            logger.error(`error [getStatus]3: ${errStr}`);
          } else {
            // console.log(`---------- 多签创建完毕后 回调函数的else 中 [${JSON.stringify(status?.wallet)}]`);
            if (status?.wallet && status?.wallet?.status !== 'complete') {
              navigation.navigate('Wallet', {
                screen: 'Copayers',
                params: {
                  wallet: key?.wallets[0],
                  status: status?.wallet,
                },
              });
            }
          }
        },
      );
    }
  }, [navigation, key?.wallets, context]);

  useEffect(() => {
    dispatch(Analytics.track('View Key'));
  }, []);

  const {wallets = [], totalBalance} = useAppSelector(({WALLET}) => WALLET.keys[id]) || {};

  const memorizedWalletList = useMemo(() => {
    const coins = wallets.filter(
      wallet => !wallet.credentials.token && !wallet.hideWallet,
    );
    const tokens = wallets.filter(
      wallet => wallet.credentials.token && !wallet.hideWallet,
    );

    return buildNestedWalletList(
      coins,
      tokens,
      defaultAltCurrency.isoCode,
      rates,
      dispatch,
    );
  }, [dispatch, wallets, defaultAltCurrency.isoCode, rates]);

  const keyOptions: Array<Option> = [];



  const updateBalance = (walletId: string, sat: number): void => {
    let currentWallet = null;
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      if(wallet.id === walletId){
        console.log(`----------  updateBalance 接收的参数: walletId = [${walletId}]    sat = [${sat}]  `);
        currentWallet = wallets[i];
        currentWallet.balance.sat = sat;
        wallets[i] = currentWallet;
      }
    }
  }

  if (!key?.methods?.isPrivKeyEncrypted()) {
    if (!key?.isReadOnly) {
      keyOptions.push({
        img: <Icons.Encrypt />,
        title: t('Encrypt your Key'),
        description: t(
          'Prevent an unauthorized user from sending funds out of your wallet.',
        ),
        onPress: () => {
          haptic('impactLight');

          navigation.navigate('Wallet', {
            screen: 'CreateEncryptPassword',
            params: {
              key,
            },
          });
        },
      });
    }

    keyOptions.push({
      img: <Icons.Settings />,
      title: t('Key Settings'),
      description: t('View all the ways to manage and configure your key.'),
      onPress: () => {
        haptic('impactLight');
        navigation.navigate('Wallet', {
          screen: 'KeySettings',
          params: {
            key,
          },
        });
      },
    });
  }

  const onPressTxpBadge = useMemo(
    () => () => {
      navigation.navigate('Wallet', {
        screen: 'TransactionProposalNotifications',
        params: {keyId: key.id},
      });
    },
    [],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      dispatch(getPriceHistory(defaultAltCurrency.isoCode));
      await dispatch(startGetRates({force: true}));
      await Promise.all([
        dispatch(startUpdateAllWalletStatusForKey({key, force: true})),
        sleep(1000),
      ]);
      dispatch(updatePortfolioBalance());
    } catch (err) {
      dispatch(showBottomNotificationModal(BalanceUpdateError()));
    }
    setRefreshing(false);
  };

  const memoizedRenderItem = useCallback(
    ({item}: {item: WalletRowProps}) => {
      let contract: any = undefined;
      if(item.isToken) {
        // contract = getTokenContract(item.network, item.currentWallet.credentials?.token?.address, item.currentWallet.currencyAbbreviation, USDT_USDC_ABI);
        contract = getTokenContract('goerli', '0x9DC9a9a2a753c13b63526d628B1Bf43CabB468Fe', item.currentWallet.currencyAbbreviation, USDT_USDC_ABI);
      }
      return (
        <WalletRow
          id={item.id}
          wallet={item}
          updateBalance={(walletId: string, sat: number) => {updateBalance(walletId, sat)}}
          contract={contract}
          onPress={() => {
            haptic('impactLight');
            const fullWalletObj = key.wallets.find(k => k.id === item.id)!;
            if (!fullWalletObj.isComplete()) {
              console.log(`---------- 点击钱包列表， 准备跳转钱包详情的时候 fullWalletObj = [${JSON.stringify(fullWalletObj)}]`);
              fullWalletObj.getStatus(
                {network: fullWalletObj.network},
                (err: any, status: Status) => {
                  console.log(`---------- 点击钱包列表， getStatus回调函数 status = [${JSON.stringify(status)}]`);
                  if (err) {
                    const errStr =
                      err instanceof Error ? err.message : JSON.stringify(err);
                    logger.error(`error [getStatus]4: ${errStr}`);
                  } else {
                    if (status?.wallet?.status === 'complete') {
                      fullWalletObj.openWallet({}, () => {
                        navigation.navigate('Wallet', {
                          screen: 'WalletDetails',
                          params: {
                            walletId: item.id,
                            key,
                          },
                        });
                      });
                      return;
                    }
                    navigation.navigate('Wallet', {
                      screen: 'Copayers',
                      params: {
                        wallet: fullWalletObj,
                        status: status?.wallet,
                      },
                    });
                  }
                },
              );
            } else {
              navigation.navigate('Wallet', {
                screen: 'WalletDetails',
                params: {
                  key,
                  walletId: item.id,
                  contract,
                  updateBalance
                },
              });
            }
          }}
        />
      );
    },
    [key, navigation],
  );

  return (
    <OverviewContainer>
      <BalanceContainer>
        <TouchableOpacity
          onLongPress={() => {
            dispatch(toggleHideKeyBalance({keyId: key.id}));
          }}>
          <Row>
            {!key?.hideKeyBalance ? (
              <Balance scale={shouldScale(totalBalance)}>
                {formatFiatAmount(totalBalance, defaultAltCurrency.isoCode, {
                  currencyDisplay: 'symbol',
                })}
              </Balance>
            ) : (
              <H2>****</H2>
            )}
          </Row>
        </TouchableOpacity>
      </BalanceContainer>

      <Hr />

      <FlatList<WalletRowProps>
        refreshControl={
          <RefreshControl
            tintColor={theme.dark ? White : SlateDark}
            refreshing={refreshing}
            onRefresh={() => onRefresh()}
          />
        }
        ListHeaderComponent={() => {
          return (
            <WalletListHeader>
              <H5>{t('My Wallets')}</H5>
            </WalletListHeader>
          );
        }}
        ListFooterComponent={() => {


          console.log(`---------- key = [${JSON.stringify(key)}]`);



          const chainList = key.wallets.map((wallet) => {
            return wallet.credentials.chain
          });
          const chainSet = new Set(chainList);
          const result = Array.from(chainSet);
          // console.log(`---------- chainList = [${JSON.stringify(result)}]`);

          // return null;
          if (result.includes('btc')) {
            return null;
          }
          return (
            <WalletListFooter
              activeOpacity={ActiveOpacity}
              onPress={() => {
                haptic('impactLight');
                navigation.navigate('Wallet', {
                  screen: 'AddingOptions',
                  params: {
                    key,
                  },
                });
              }}>
              <Icons.Add />
              <WalletListFooterText>{t('Add Wallet')}</WalletListFooterText>
            </WalletListFooter>
          );
        }}
        data={memorizedWalletList}
        renderItem={memoizedRenderItem}
      />

      {keyOptions.length > 0 ? (
        <OptionsSheet
          isVisible={showKeyOptions}
          title={t('Key Options')}
          options={keyOptions}
          closeModal={() => setShowKeyOptions(false)}
        />
      ) : null}

      <SheetModal
        isVisible={showKeyDropdown}
        placement={'top'}
        onBackdropPress={() => setShowKeyDropdown(false)}>
        <KeyDropdown>
          <HeaderTitle style={{margin: 15}}>{t('Other Keys')}</HeaderTitle>
          <KeyDropdownOptionsContainer>
            {Object.values(keys)
              .filter(_key => _key.backupComplete && _key.id !== id)
              .map(_key => (
                <KeyDropdownOption
                  key={_key.id}
                  keyId={_key.id}
                  keyName={_key.keyName}
                  wallets={_key.wallets}
                  totalBalance={_key.totalBalance}
                  onPress={keyId => {
                    setShowKeyDropdown(false);
                    navigation.setParams({
                      id: keyId,
                    } as any);
                  }}
                  defaultAltCurrencyIsoCode={defaultAltCurrency.isoCode}
                  hideKeyBalance={_key.hideKeyBalance}
                />
              ))}
            {linkedCoinbase ? (
              <CoinbaseDropdownOption
                onPress={() => {
                  setShowKeyDropdown(false);
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 2,
                      routes: [
                        {
                          name: 'Tabs',
                          params: {screen: 'Home'},
                        },
                        {
                          name: 'Coinbase',
                          params: {
                            screen: 'CoinbaseRoot',
                          },
                        },
                      ],
                    }),
                  );
                }}
              />
            ) : null}
          </KeyDropdownOptionsContainer>
        </KeyDropdown>
      </SheetModal>
    </OverviewContainer>
  );
};

export default KeyOverview;
