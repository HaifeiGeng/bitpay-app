import React, {useState, useEffect, useCallback, useLayoutEffect} from 'react';
import {useNavigation, useRoute, CommonActions} from '@react-navigation/native';
import {RouteProp, StackActions} from '@react-navigation/core';
import {WalletStackParamList} from '../../../WalletStack';
import {useAppDispatch, useAppSelector} from '../../../../../utils/hooks';
import {
  Recipient,
  TransactionProposal,
  TxDetails,
  Utxo,
  Wallet,
} from '../../../../../store/wallet/wallet.models';
import SwipeButton from '../../../../../components/swipe-button/SwipeButton';
import {
  createProposalAndBuildTxDetails,
  createTokenProposalAndBuildTxDetails,
  handleCreateTxProposalError,
  startSendPayment,
} from '../../../../../store/wallet/effects/send/send';
import PaymentSent from '../../../components/PaymentSent';
import {formatFiatAmount, sleep} from '../../../../../utils/helper-methods';
import {
  openUrlWithInAppBrowser,
  startOnGoingProcessModal,
} from '../../../../../store/app/app.effects';
import {
  dismissOnGoingProcessModal,
  showBottomNotificationModal,
  dismissBottomNotificationModal,
} from '../../../../../store/app/app.actions';
import {
  Amount,
  ConfirmContainer,
  ConfirmScrollView,
  DetailsList,
  ExchangeRate,
  Fee,
  Header,
  SendingFrom,
  SendingTo,
  SharedDetailRow,
} from './Shared';
import {BottomNotificationConfig} from '../../../../../components/modal/bottom-notification/BottomNotification';
import {
  CustomErrorMessage,
  WrongPasswordError,
} from '../../../components/ErrorMessages';
import {URL} from '../../../../../constants';
import {BWCErrorMessage} from '../../../../../constants/BWCError';
import TransactionLevel from '../TransactionLevel';
import {
  BaseText,
  HeaderTitle,
  InfoDescription,
  Link,
} from '../../../../../components/styled/Text';
import styled from 'styled-components/native';
import ToggleSwitch from '../../../../../components/toggle-switch/ToggleSwitch';
import {useTranslation} from 'react-i18next';
import {
  ActiveOpacity,
  Hr,
  Info,
  InfoTriangle,
  ScreenGutter,
} from '../../../../../components/styled/Containers';
import {Platform, TouchableOpacity} from 'react-native';
import {GetFeeOptions} from '../../../../../store/wallet/effects/fee/fee';
import haptic from '../../../../../components/haptic-feedback/haptic';
import {Memo} from './Memo';
import {toFiat} from '../../../../../store/wallet/utils/wallet';
import {GetPrecision} from '../../../../../store/wallet/utils/currency';
import prompt from 'react-native-prompt-android';
import {Analytics} from '../../../../../store/analytics/analytics.effects';
import DynamicQrCode from '../../../components/DynamicQrCode';
import DynamicEthQrCode from '../../../components/DynamicEthQrCode';
import ReceiveAddress from '../../../components/ReceiveAddress';
import {
  BitcoreLib as Bitcore
} from 'crypto-wallet-core';
import Loading from './loading/Loading';
import { BigNumber, ethers } from "ethers";
import { LogActions } from '../../../../../store/log';
import { CANAAN_ABI, getProvider, getTokenContract } from '../../../../../constants/EthContract';

const VerticalPadding = styled.View`
  padding: ${ScreenGutter} 0;
`;
export interface ConfirmParamList {
  wallet: Wallet;
  recipient: Recipient;
  recipientList?: Recipient[];
  txp: Partial<TransactionProposal>;
  txDetails: TxDetails;
  amount: number;
  speedup?: boolean;
  sendMax?: boolean;
  inputs?: Utxo[];
  selectInputs?: boolean;
  message?: string | undefined;
}

export const Setting = styled.TouchableOpacity`
  align-items: center;
  flex-direction: row;
  flex-wrap: nowrap;
  height: 58px;
`;

export const SettingTitle = styled(BaseText)`
  color: ${({theme}) => theme.colors.text};
  flex-grow: 1;
  flex-shrink: 1;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  letter-spacing: 0;
  text-align: left;
  margin-right: 5px;
`;

const Confirm = () => {
  // 是否开启动态二维码窗口
  const [showBtcDynamicQrCodeModal, setShowBtcDynamicQrCodeModal] = useState(false);
  const [showEthDynamicQrCodeModal, setShowEthDynamicQrCodeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);



  const [dynamicQrCodeData, setDynamicQrCodeData] = useState({});

  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {t} = useTranslation();
  const route = useRoute<RouteProp<WalletStackParamList, 'Confirm'>>();
  const {
    wallet,
    recipient,
    recipientList,
    txDetails,
    txp: _txp,
    amount,
    speedup,
    sendMax,
    inputs,
    selectInputs,
    message,
  } = route.params;
  const [txp, setTxp] = useState(_txp);
  const allKeys = useAppSelector(({WALLET}) => WALLET.keys);
  const enableReplaceByFee = useAppSelector( ({WALLET}) => WALLET.enableReplaceByFee);
  const customizeNonce = useAppSelector(({WALLET}) => WALLET.customizeNonce);
  const rates = useAppSelector(({RATE}) => RATE.rates);
  const {isoCode} = useAppSelector(({APP}) => APP.defaultAltCurrency);

  const key = allKeys[wallet?.keyId!];
  const [showPaymentSentModal, setShowPaymentSentModal] = useState(false);
  const [resetSwipeButton, setResetSwipeButton] = useState(false);
  const [showTransactionLevel, setShowTransactionLevel] = useState(false);
  const [enableRBF, setEnableRBF] = useState(false);

  const {
    fee: _fee,
    sendingTo,
    sendingFrom,
    subTotal: _subTotal,
    gasLimit: _gasLimit,
    gasPrice: _gasPrice,
    nonce: _nonce,
    total: _total,
    destinationTag: _destinationTag,
    context,
    rateStr,
  } = txDetails;
  const [fee, setFee] = useState(_fee);
  const [total, setTotal] = useState(_total);
  const [subTotal, setSubTotal] = useState(_subTotal);
  const [gasPrice, setGasPrice] = useState(_gasPrice);
  const [gasLimit, setGasLimit] = useState(_gasLimit);
  const [nonce, setNonce] = useState(_nonce);
  const [destinationTag, setDestinationTag] = useState(
    recipient?.destinationTag || _destinationTag,
  );
  const {currencyAbbreviation, chain} = wallet;
  const feeOptions = GetFeeOptions(chain);
  const {unitToSatoshi} = dispatch(GetPrecision(currencyAbbreviation, chain)) || {};

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitle>
          {t('Confirm ', {title: speedup ? t('Speed Up') : t('Payment')})}
        </HeaderTitle>
      ),
    });
  }, [navigation, speedup, t]);

  const isTxLevelAvailable = () => {
    const includedCurrencies = ['btc', 'eth', 'matic'];
    // TODO: exclude paypro, coinbase, usingMerchantFee txs,
    // const {payProUrl} = txDetails;
    return includedCurrencies.includes(currencyAbbreviation);
  };

  const onCloseTxLevelModal = async (
    newLevel?: any,
    customFeePerKB?: number,
  ) => {
    setShowTransactionLevel(false);
    if (newLevel) {
      updateTxProposal({
        feeLevel: newLevel,
        feePerKb: customFeePerKB,
      });
    }
  };

  const editValue = (title: string, type: string) => {
    prompt(
      title,
      '',
      [
        {
          text: t('Cancel'),
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: t('OK'),
          onPress: value => {
            const opts: {
              nonce?: number;
              gasLimit?: number;
              destinationTag?: number;
            } = {};
            switch (type) {
              case 'nonce':
                opts.nonce = Number(value);
                break;
              case 'gasLimit':
                opts.gasLimit = Number(value);
                break;
              case 'destinationTag':
                opts.destinationTag = Number(value);
                break;
              default:
                break;
            }
            updateTxProposal(opts);
          },
        },
      ],
      {
        type: Platform.OS === 'ios' ? 'plain-text' : 'numeric',
        cancelable: true,
        defaultValue: '',
        // @ts-ignore
        keyboardType: 'numeric',
      },
    );
  };

  const onChangeEnableReplaceByFee = async (enableRBF?: boolean) => {
    updateTxProposal({
      enableRBF,
    });
  };

  const updateTxProposal = async (newOpts: any) => {
    try {
      dispatch(startOnGoingProcessModal('UPDATING_TXP'));
      const {txDetails: _txDetails, txp: newTxp} = await dispatch(
        createProposalAndBuildTxDetails({
          wallet,
          recipient,
          recipientList,
          amount,
          sendMax,
          inputs,
          context,
          ...txp,
          ...newOpts,
        }),
      );

      setTxp(newTxp);
      setFee(_txDetails.fee);
      setTotal(_txDetails.total);
      setSubTotal(_txDetails.subTotal);
      setGasPrice(_txDetails.gasPrice);
      setGasLimit(_txDetails.gasLimit);
      setNonce(_txDetails.nonce);
      setDestinationTag(_txDetails.destinationTag);
      await sleep(500);
      dispatch(dismissOnGoingProcessModal());
    } catch (err: any) {
      dispatch(dismissOnGoingProcessModal());
      const [errorMessageConfig] = await Promise.all([
        dispatch(handleCreateTxProposalError(err)),
        sleep(400),
      ]);
      dispatch(
        showBottomNotificationModal({
          ...errorMessageConfig,
          enableBackdropDismiss: false,
          actions: [
            {
              text: t('OK'),
              action: () => {},
            },
          ],
        }),
      );
    }
  };

  useEffect(() => {
    if (!resetSwipeButton) {
      return;
    }
    const timer = setTimeout(() => {
      setResetSwipeButton(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [resetSwipeButton]);


  useEffect(() => {
    console.log(`---------- Confirm.tsx页面中 , txDetails = [${JSON.stringify(txDetails)}]`);
    console.log(`---------- Confirm.tsx页面中 , txp = [${JSON.stringify(txp)}]`);
    console.log(`---------- Confirm.tsx页面中 , key = [${JSON.stringify(key)}]`);
  }, [])

  const showErrorMessage = useCallback(
    async (msg: BottomNotificationConfig) => {
      await sleep(500);
      dispatch(showBottomNotificationModal(msg));
    },
    [dispatch],
  );

  let recipientData, recipientListData;

  if (recipientList) {
    recipientListData = recipientList.map(r => {
      const amountSat = Number(r.amount! * unitToSatoshi!);
      return {
        recipientName: r.name,
        recipientAddress: r.address,
        img: r.type === 'contact' ? r.type : wallet.img,
        recipientAmountStr: `${r.amount} ${currencyAbbreviation.toUpperCase()}`,
        recipientAltAmountStr: formatFiatAmount(
          dispatch(
            toFiat(amountSat, isoCode, currencyAbbreviation, chain, rates),
          ),
          isoCode,
        ),
        recipientType: r.type,
        recipientCoin: currencyAbbreviation,
        recipientChain: r.chain,
      };
    });
  }

  if (
    recipient.type &&
    (recipient.type === 'coinbase' || recipient.type === 'contact')
  ) {
    recipientData = {
      recipientName: recipient.name,
      recipientAddress: sendingTo.recipientAddress,
      img: recipient.type,
      recipientChain: recipient.chain,
      recipientType: recipient.type,
    };
  } else {
    recipientData = sendingTo;
  }

  const onShowPaymentSent = () => {
    setShowPaymentSentModal(true);
  }

  const getSpendNonce = async (currContract: any) => {
    const currentNonce = await currContract.getSpendNonce();
    console.log(`----------  获取Nonce完毕, currentNonce = [${parseInt(currentNonce)}]`);
    return parseInt(currentNonce);
  }

  const closeModal = () => {
    dispatch(dismissOnGoingProcessModal());
    setTimeout(() => {
      setShowBtcDynamicQrCodeModal(false);
      setShowEthDynamicQrCodeModal(false);
    }, 50); // 延迟时间可以根据需要进行调整
  }


  const showLoading = (flag: boolean) => {
    setIsLoading(flag);
  }

  return (
    <ConfirmContainer>
      <ConfirmScrollView
        extraScrollHeight={50}
        contentContainerStyle={{paddingBottom: 50}}
        keyboardShouldPersistTaps={'handled'}>
        <DetailsList keyboardShouldPersistTaps={'handled'}>
          <Header>Summary</Header>
          <SendingTo
            recipient={recipientData}
            recipientList={recipientListData}
            hr
          />
          <Fee
            onPress={
              isTxLevelAvailable() && !selectInputs
                ? () => setShowTransactionLevel(true)
                : undefined
            }
            fee={fee}
            feeOptions={feeOptions}
            hr
          />
          {enableReplaceByFee &&
          !selectInputs &&
          currencyAbbreviation === 'btc' ? (
            <>
              <Setting activeOpacity={1}>
                <SettingTitle>{t('Enable Replace-By-Fee')}</SettingTitle>
                <ToggleSwitch
                  onChange={value => {
                    setEnableRBF(value);
                    onChangeEnableReplaceByFee(value);
                  }}
                  isEnabled={enableRBF}
                />
              </Setting>
              <Hr />
            </>
          ) : null}
          {gasPrice !== undefined ? (
            <SharedDetailRow
              description={t('Gas price')}
              value={gasPrice.toFixed(2) + ' Gwei'}
              hr
            />
          ) : null}
          {gasLimit !== undefined ? (
            <SharedDetailRow
              description={t('Gas limit')}
              value={gasLimit}
              onPress={() => editValue(t('Edit gas limit'), 'gasLimit')}
              hr
            />
          ) : null}
          {nonce !== undefined && nonce !== null ? (
            <SharedDetailRow
              description={t('Nonce')}
              value={nonce}
              onPress={
                customizeNonce
                  ? () => editValue(t('Edit nonce'), 'nonce')
                  : undefined
              }
              hr
            />
          ) : null}
          <SendingFrom sender={sendingFrom} hr />
          {rateStr ? (
            <ExchangeRate description={t('Exchange Rate')} rateStr={rateStr} />
          ) : null}
          {currencyAbbreviation === 'xrp' ? (
            <>
              <SharedDetailRow
                description={t('Destination Tag')}
                value={destinationTag || 'edit'}
                onPress={() =>
                  editValue(t('Edit destination tag'), 'destinationTag')
                }
              />
              <Info>
                <InfoTriangle />
                <InfoDescription>
                  {t(
                    'A Destination Tag is an optional number that corresponds to an invoice or a XRP account on an exchange.',
                  )}
                </InfoDescription>

                <VerticalPadding>
                  <TouchableOpacity
                    activeOpacity={ActiveOpacity}
                    onPress={() => {
                      haptic('impactLight');
                      dispatch(
                        openUrlWithInAppBrowser(URL.HELP_DESTINATION_TAG),
                      );
                    }}>
                    <Link>{t('Learn More')}</Link>
                  </TouchableOpacity>
                </VerticalPadding>
              </Info>
            </>
          ) : null}
          {txp && currencyAbbreviation !== 'xrp' ? (
            <Memo
              memo={txp.message || message || ''}
              onChange={message => setTxp({...txp, message})}
            />
          ) : null}
          <Amount
            description={t('SubTotal')}
            amount={subTotal}
            height={83}
            chain={chain}
            network={wallet.credentials.network}
          />
          <Amount
            description={t('Total')}
            amount={total}
            height={83}
            chain={chain}
            network={wallet.credentials.network}
          />
        </DetailsList>

        <PaymentSent
          isVisible={showPaymentSentModal}
          title={
            wallet.credentials.n > 1 ? t('Proposal created') : t('Payment Sent')
          }
          onCloseModal={async () => {
            setShowPaymentSentModal(false);
            if (recipient.type === 'coinbase') {
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
            } else {
              let contract = undefined;
              const isToken = !!wallet.credentials?.token && !wallet.hideWallet && wallet.chain === 'eth';
              if(isToken){
                contract = getTokenContract(wallet.network, wallet.credentials?.token?.address, wallet.currencyAbbreviation);
              }
              navigation.dispatch(StackActions.popToTop());
              navigation.dispatch(
                StackActions.replace('WalletDetails', {
                  walletId: wallet!.id,
                  key,
                  contract,
                }),
              );
              await sleep(0);
              setShowPaymentSentModal(false);
            }
          }}
        />
        {isTxLevelAvailable() ? (
          <TransactionLevel
            feeLevel={fee.feeLevel}
            wallet={wallet}
            isVisible={showTransactionLevel}
            onCloseModal={(selectedLevel, customFeePerKB) =>
              onCloseTxLevelModal(selectedLevel, customFeePerKB)
            }
            customFeePerKB={
              fee.feeLevel === 'custom' ? txp?.feePerKb : undefined
            }
            feePerSatByte={
              fee.feeLevel === 'custom' && txp?.feePerKb
                ? txp?.feePerKb / 1000
                : undefined
            }
            isSpeedUpTx={speedup}
          />
        ) : null}
      </ConfirmScrollView>
      <SwipeButton
        title={speedup ? t('Speed Up') : t('Slide to send')}
        forceReset={resetSwipeButton}
        onSwipeComplete={async () => {
          try {
            // 开始转圈
            dispatch(startOnGoingProcessModal('SENDING_PAYMENT'));
            dispatch(LogActions.info('Start [SwipeButton] 滑动支付按钮'));
            await sleep(500);

            console.log(`---------- 确认页面 - 滑动以发送: key = [${JSON.stringify(key)}] `);
            console.log(`---------- 确认页面 - 滑动以发送: wallet = [${JSON.stringify(wallet)}] `);
            console.log(`---------- 确认页面 - 滑动以发送: txp = [${JSON.stringify(txp)}] `);
            console.log(`---------- 确认页面 - 滑动以发送: recipient = [${JSON.stringify(recipient)}]`);
            console.log(`---------- 确认页面 - 滑动以发送: 当前链 chain = [${wallet.chain}]`);

            // 检查是否为TOKEN
            const isToken = !!wallet.credentials?.token;
            console.log(`---------- 确认页面 - 滑动以发送: 是否为token isToken = [${isToken}]`);

            let txpResult = undefined;
            if(isToken){
              console.log(`---------- 确认页面 - 滑动以发送: 自定义地址开关 customAddressEnabled = [${wallet.customAddressEnabled}]`);
              // 如果是token，需要继续判断他是否自定义地址。
              if(wallet.customAddressEnabled !== undefined && !wallet.customAddressEnabled){
                // 如果《非自定义地址》 && 货币缩写 !== eth
                if(wallet.currencyAbbreviation.toLowerCase() === 'eth'){
                  throw new Error(t('Wallet error, ETH wallet transactions without custom payment address are not allowed'));
                }
                dispatch(LogActions.info('Success [SwipeButton] 滑动支付按钮: 是token, 并且没有自定义收款地址.'));
                // 需要判断, 如果不是自定义收款地址的话，才允许单签支付。
                await dispatch(startSendPayment({txp, key, wallet, recipient}));
                dispatch(dismissOnGoingProcessModal());
                dispatch(
                  Analytics.track('Sent Crypto', {
                    context: 'Confirm',
                    coin: currencyAbbreviation || '',
                  }),
                );
                await sleep(500);
                setShowPaymentSentModal(true);
                dispatch(LogActions.info('Success [SwipeButton] 滑动支付按钮: 是token, 并且没有自定义收款地址. 支付完成'));
                return;
              }

              dispatch(LogActions.info('Success [SwipeButton] 滑动支付按钮: 是token, 已经自定义收款地址, 需要使用冷钱包进行签名, 准备展示动态二维码'));
              // 检查当前需要支付手续费钱包的余额，如果不足以支付手续费，则抛异常, 打印txDetails
              console.log(`---------- 确认页面 - 滑动以发送: txDetails = [${JSON.stringify(txDetails)}]`)
              if(!txDetails.gasPrice || !txDetails.gasLimit){
                throw new Error(t('please check gasPrice or gasLimit'));
              }
              const provider = getProvider(wallet.network)
              const xpriv = new Bitcore.HDPrivateKey(key.properties!.xPrivKey);
              const derived = xpriv.derive(wallet.credentials.rootPath + '/0/0');
              const subPrivateKey = '0x' + derived.privateKey;
              const ethersWallet = new ethers.Wallet(subPrivateKey, provider);

              console.log(`---------- 确认页面 - 滑动以发送: ethersWallet = [${JSON.stringify(ethersWallet)}]`);
              const ethersReceiveAddress = ethersWallet.address;
              const allFee = txDetails.gasPrice * txDetails.gasLimit;
              const balance = await provider.getBalance(ethersReceiveAddress);
              const gweiBalance = ethers.utils.formatUnits(balance, 'gwei');
              console.log(`---------- 确认页面 - 滑动以发送: allFee = [${allFee}]  balance = [${BigNumber.from(balance.toString())}] gweiBalance = [${gweiBalance}]`);
              // 如果手续费大于余额的话， 抛出异常
              if(BigNumber.from(allFee).gt(BigNumber.from(parseInt(gweiBalance)))){
                throw new Error(t('Insufficient balance, please check') + `\nGweiBalance = [${gweiBalance}] fee = [${allFee}]`);
              }
              
              const currContract = getTokenContract(wallet.network, wallet.receiveAddress!, wallet.currencyAbbreviation, CANAAN_ABI);
              if(!currContract){
                // 如果写合约存在问题，抛异常
                throw new Error( `Contract Error! Save Session Log Please.`);
              }
              const coin = txp.chain;
              // 共有几个人
              const ownerArray = await currContract.getOwners();
              // 签名最少需要几个人
              const n = await currContract.getRequired();
              const nonce = await getSpendNonce(currContract);


              let data = '0x';
              let destination = '0x';
              let value = 0;
              // 如果自定义地址,  并且货币为ETH
              if(wallet.currencyAbbreviation.toLowerCase() === 'eth'){
                // 没有data， 没有destination，
                // 实际的value
                value = parseInt(String(txp.outputs![0].amount));
                destination = recipient.address;
              } else {
                data = txp.outputs![0].data || '';
                destination = txp.tokenAddress!;
                // destination = '0x9DC9a9a2a753c13b63526d628B1Bf43CabB468Fe'; // TODO 测试完毕删除, 应该是主网的USDT的合约地址: 0xdac17f958d2ee523a2206206994597c13d831ec7
              }
              txpResult = {
                data,
                value,
                destination,
                coin,
                nonce,
                properties: key.properties!.xPrivKey,
                m: ownerArray.length,
                n: parseInt(n),
                receiveAddress: wallet.receiveAddress!,
              }
            } else {
              // 如果不是token, 需要检查是否为ETH, 并且m/n都等于1，并且非Readonly, 如果以上条件都满足，则需要直接签名
              console.log(`---------- 确认页面 - 滑动以发送: 不是token, chain = [${wallet.chain}], m = [${wallet.m}], n = [${wallet.n}], !isReadOnly = [${!key.isReadOnly}]`);
              if(wallet.m === 1 && wallet.n === 1 && !key.isReadOnly){
                dispatch(LogActions.info(`Success [SwipeButton] 滑动支付按钮: 不是token, 币种[${wallet.chain}], 非只读, 单签, 准备直接付款`));
                await dispatch(startSendPayment({txp, key, wallet, recipient}));
                dispatch(dismissOnGoingProcessModal());
                dispatch(
                  Analytics.track('Sent Crypto', {
                    context: 'Confirm',
                    coin: currencyAbbreviation || '',
                  }),
                );
                await sleep(500);
                setShowPaymentSentModal(true);
                dispatch(LogActions.info(`Success [SwipeButton] 滑动支付按钮: 不是token, 币种[${wallet.chain}], 非只读, 单签, 付款完毕`));
                return;
              } else {
                // 不是token, 但是是只读钱包, 需要冷钱包
                txpResult = await dispatch(startSendPayment({txp, key, wallet, recipient}));
              }
            }
            
            console.log(`---------- SwipeButton的最终返回值 txpResult = [${JSON.stringify(txpResult)}]`);
            dispatch(LogActions.info(`Success [SwipeButton] 滑动支付按钮: 开始准备展示动态二维码`));
            await sleep(500);
            // 将按钮恢复到未滑动状态
            setResetSwipeButton(true);
            await sleep(500);
            // 停止转圈
            dispatch(dismissOnGoingProcessModal());
            setDynamicQrCodeData({txp: txpResult, wallet});
            if(wallet.chain === 'btc'){
              setShowBtcDynamicQrCodeModal(true);
            }
            if(wallet.chain === 'eth'){
              setShowEthDynamicQrCodeModal(true);
            }
            dispatch(LogActions.info('Success [SwipeButton] 滑动支付按钮'));
            await sleep(500);
          } catch (err) {
            setResetSwipeButton(true);
            await sleep(500);
            dispatch(dismissOnGoingProcessModal());
            await sleep(500);
            const errorStr = err instanceof Error ? err.message : JSON.stringify(err);
            dispatch(LogActions.error(`Failed [SwipeButton] 滑动支付按钮 出错了: ${errorStr}`));
            switch (err) {
              case 'invalid password':
                dispatch(showBottomNotificationModal(WrongPasswordError()));
                break;
              case 'password canceled':
                break;
              case 'biometric check failed':
                setResetSwipeButton(true);
                break;
              default:
                await showErrorMessage(
                  CustomErrorMessage({
                    errMsg: BWCErrorMessage(err),
                    title: t('Uh oh, something went wrong'),
                  }),
                );
            }
          }
        }}
      />
      {
        showBtcDynamicQrCodeModal ?
        (
          <DynamicQrCode 
            isVisible={showBtcDynamicQrCodeModal} 
            closeModal={() => {closeModal()}} 
            dynamicQrCodeData={dynamicQrCodeData} 
            onShowPaymentSent={() => {onShowPaymentSent()}}
          />
        ) : null
      }
      {
        showEthDynamicQrCodeModal ? 
          (
            <DynamicEthQrCode 
              isVisible={showEthDynamicQrCodeModal} 
              closeModal={() => {closeModal()}} 
              dynamicEthQrCodeData={dynamicQrCodeData} 
              onShowPaymentSent={() => {onShowPaymentSent()}}
              showLoading={(flag: boolean) => showLoading(flag)}
            />
          ) : null
      }
      {
        isLoading ? 
          (
            <Loading text="Sending Payment..." />
          ) : null
      }
    </ConfirmContainer>
  );
};

export default Confirm;
