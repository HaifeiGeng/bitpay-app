import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from 'styled-components/native';
import {
  Caution,
  LightBlack,
  NeutralSlate,
  SlateDark,
  White,
} from '../../../styles/colors';
import ScanSvg from '../../../../assets/img/onboarding/scan.svg';
import {
  ActiveOpacity,
  AdvancedOptions,
  AdvancedOptionsButton,
  AdvancedOptionsButtonText,
  AdvancedOptionsContainer,
  Column,
  CtaContainer as _CtaContainer,
  HeaderContainer,
  ImportTextInput,
  Row,
  ScanContainer,
  ScreenGutter,
  SheetContainer,
} from '../../../components/styled/Containers';
import Button from '../../../components/button/Button';
import {useDispatch, useSelector} from 'react-redux';
import {
  dismissOnGoingProcessModal,
  setHomeCarouselConfig,
  showBottomNotificationModal,
} from '../../../store/app/app.actions';
import {yupResolver} from '@hookform/resolvers/yup';
import yup from '../../../lib/yup';
import {Controller, useForm} from 'react-hook-form';
import {
  BaseText,
  H4,
  ImportTitle,
  Paragraph,
  Small,
  TextAlign,
} from '../../../components/styled/Text';
import BoxInput from '../../../components/form/BoxInput';
import {useLogger} from '../../../utils/hooks/useLogger';
import {Key, KeyOptions} from '../../../store/wallet/wallet.models';
import {
  startCreateKeyWithOptsNew,
  startGetRates,
  startImportPublicKey,
} from '../../../store/wallet/effects';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ImportObj} from '../../../store/scan/scan.models';
import {RouteProp} from '@react-navigation/core';
import {WalletStackParamList} from '../WalletStack';
import {startOnGoingProcessModal} from '../../../store/app/app.effects';
import {backupRedirect} from '../screens/Backup';
import {RootState} from '../../../store';
import Haptic from '../../../components/haptic-feedback/haptic';
import ChevronDownSvg from '../../../../assets/img/chevron-down.svg';
import ChevronUpSvg from '../../../../assets/img/chevron-up.svg';
import Checkbox from '../../../components/checkbox/Checkbox';
import {
  getAccount,
  getDerivationStrategy,
  getNetworkName,
  isValidDerivationPathCoin,
  keyExtractor,
  parsePath,
  sleep,
} from '../../../utils/helper-methods';
import {DefaultDerivationPath} from '../../../constants/defaultDerivationPath';
import {startUpdateAllWalletStatusForKey} from '../../../store/wallet/effects/status/status';
import {CurrencyImage} from '../../../components/currency-image/CurrencyImage';
import {SupportedCurrencyOptions} from '../../../constants/SupportedCurrencyOptions';
import Icons from './WalletIcons';
import SheetModal from '../../../components/modal/base/sheet/SheetModal';
import {FlatList, ScrollView} from 'react-native';
import CurrencySelectionRow from '../../../components/list/CurrencySelectionRow';
import {updatePortfolioBalance} from '../../../store/wallet/wallet.actions';
import {
  GetName,
  isSingleAddressCoin,
} from '../../../store/wallet/utils/currency';
import {useTranslation} from 'react-i18next';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {Analytics} from '../../../store/analytics/analytics.effects';





const ScrollViewContainer = styled(KeyboardAwareScrollView)`
  margin-top: 20px;
`;

const ContentView = styled(ScrollView)`
  padding: 0 ${ScreenGutter};
`;

const PasswordParagraph = styled(BaseText)`
  margin: 0px 20px 20px 20px;
  color: ${({theme}) => theme.colors.description};
`;

const ErrorText = styled(BaseText)`
  color: ${Caution};
  font-size: 12px;
  font-weight: 500;
  padding: 5px 0 0 10px;
`;

const CuationText = styled(Small)`
  padding: 5px 0 0 0px;
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const schema = yup.object().shape({
  text: yup.string().required(),
});

const CheckBoxContainer = styled.View`
  flex-direction: column;
  justify-content: center;
`;

const OptionTitle = styled(BaseText)`
  font-size: 16px;
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const Label = styled(BaseText)`
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  top: 0;
  left: 20px;
  color: ${({theme}) => (theme && theme.dark ? theme.colors.text : '#434d5a')};
`;

const CurrencySelectorContainer = styled.View`
  margin: 20px 0;
  position: relative;
`;

const CurrencyContainer = styled.TouchableOpacity`
  background: ${({theme}) => (theme.dark ? LightBlack : NeutralSlate)};
  padding: 0 20px;
  height: 55px;
  border: 1px solid ${({theme}) => (theme.dark ? LightBlack : NeutralSlate)};
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
`;

const CurrencyName = styled(BaseText)`
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  margin-left: 10px;
  color: #9ba3ae;
`;

const CurrencySelectionModalContainer = styled(SheetContainer)`
  padding: 15px;
  min-height: 200px;
`;

const CurrencyOptions = SupportedCurrencyOptions.filter(
  currency => !currency.isToken,
);

const RowContainer = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 18px;
`;

const InputContainer = styled.View`
  padding: 18px;
`;

const CtaContainer = styled(_CtaContainer)`
  padding: 10px 0;
`;

/**
 * 观察钱包导入 - 组件
 * @returns
 */
const RecoveryPubKey = () => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const logger = useLogger();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<WalletStackParamList, 'ImportPubKey'>>();
  const walletTermsAccepted = useSelector(
    ({WALLET}: RootState) => WALLET.walletTermsAccepted,
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [derivationPathEnabled, setDerivationPathEnabled] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(CurrencyOptions[0]);
  const [recreateWallet, setRecreateWallet] = useState(false);
  const [includeTestnetWallets, setIncludeTestnetWallets] = useState(false);
  const [includeLegacyWallets, setIncludeLegacyWallets] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState({
    derivationPath: DefaultDerivationPath.defaultBTC as string,
    coin: CurrencyOptions[0].currencyAbbreviation,
    chain: CurrencyOptions[0].currencyAbbreviation, // chain = currency for all currencies if tokens not included
    passphrase: undefined as string | undefined,
    isMultisig: false,
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: {errors},
    getValues,
  } = useForm({resolver: yupResolver(schema)});

  const showErrorModal = (e: Error) => {
    if (e && e.message === 'WALLET_DOES_NOT_EXIST') {
      dispatch(
        showBottomNotificationModal({
          type: 'warning',
          title: t("We couldn't find your wallet"),
          message: t(
            'There are no records of your wallet on our servers. If you are importing a BIP44 compatible wallet from a 3rd party you can continue to recreate it. If you wallet is not BIP44 compatible, you will not be able to access its funds.',
          ),
          enableBackdropDismiss: true,
          actions: [
            {
              text: t('Continue'),
              action: async () => {
                await sleep(500);
                if (derivationPathEnabled) {
                  const {text} = getValues();
                  setOptsAndCreateWithPubKey(text, advancedOptions);
                } else {
                  // select coin to create
                  setRecreateWallet(true);
                  setCurrencyModalVisible(true);
                }
              },
              primary: true,
            },
            {
              text: t('Go Back'),
              action: () => {},
              primary: false,
            },
          ],
        }),
      );
    } else {
      dispatch(
        showBottomNotificationModal({
          type: 'warning',
          title: t('Something went wrong'),
          message: e.message,
          enableBackdropDismiss: true,
          actions: [
            {
              text: t('OK'),
              action: () => {},
              primary: true,
            },
          ],
        }),
      );
    }
  };

  /**
   * 校验公钥
   * @param pubKey string
   * @returns 
   */
  const isValidPhrasePublicKey = (pubKey: string) => {
    if (pubKey.startsWith('xpub') || pubKey.startsWith('tpub')) {
      return true;
    }
    return false;
  };

  const processImportQrCode = (code: string): void => {
    try {
      // const parsedCode = code.split('|');
      // const recoveryObj: ImportObj = {
      //   type: parsedCode[0],
      //   data: parsedCode[1],
      //   hasPassphrase: parsedCode[4] === 'true' ? true : false,
      // };

      if (!isValidPhrasePublicKey(code)) {
        // showErrorModal(new Error(t('The recovery phrase is invalid.')));
        showErrorModal(new Error(t('The public key is invalid.')));
        return;
      }
      // if (recoveryObj.type === '1' && recoveryObj.hasPassphrase) {
      //   dispatch(
      //     showBottomNotificationModal({
      //       type: 'info',
      //       title: t('Password required'),
      //       message: t('Make sure to enter your password in advanced options'),
      //       enableBackdropDismiss: true,
      //       actions: [
      //         {
      //           text: t('OK'),
      //           action: () => {},
      //           primary: true,
      //         },
      //       ],
      //     }),
      //   );
      // }
      setValue('text', code);
    } catch (err) {
      // showErrorModal(new Error('The recovery phrase is invalid.'));
      showErrorModal(new Error(t('The public key is invalid.')));
    }
  };

  const setKeyOptions = (
    keyOpts: Partial<KeyOptions>,
    advancedOpts: {
      derivationPath: string;
      coin: string;
      chain: string;
      passphrase: string | undefined;
      isMultisig: boolean;
    },
  ) => {
    keyOpts.passphrase = advancedOpts.passphrase;

    // To clear encrypt password
    if (route.params?.keyId) {
      keyOpts.keyId = route.params.keyId;
    }

    if (derivationPathEnabled || recreateWallet) {
      const derivationPath = advancedOpts.derivationPath;

      keyOpts.networkName = getNetworkName(derivationPath);
      keyOpts.derivationStrategy = getDerivationStrategy(derivationPath);
      keyOpts.account = getAccount(derivationPath);

      /* TODO: keyOpts.n is just used to determinate if the wallet is multisig (m/48'/xx) or single sig (m/44')
      we should change the name to 'isMultisig'.
      isMultisig is used to allow import old multisig wallets with derivation strategy = 'BIP44'
      */
      keyOpts.n = advancedOpts.isMultisig
        ? 2
        : keyOpts.derivationStrategy === 'BIP48'
        ? 2
        : 1;

      keyOpts.coin = advancedOpts.coin.toLowerCase();
      keyOpts.singleAddress = dispatch(
        isSingleAddressCoin(advancedOpts.coin, advancedOpts.chain),
      );

      // set opts.useLegacyPurpose
      if (parsePath(derivationPath).purpose === "44'" && keyOpts.n > 1) {
        keyOpts.useLegacyPurpose = true;
        logger.debug('Using 44 for Multisig');
      }

      // set opts.useLegacyCoinType
      if (
        keyOpts.coin === 'bch' &&
        parsePath(derivationPath).coinCode === "0'"
      ) {
        keyOpts.useLegacyCoinType = true;
        logger.debug('Using 0 for BCH creation');
      }

      if (
        !keyOpts.networkName ||
        !keyOpts.derivationStrategy ||
        !Number.isInteger(keyOpts.account)
      ) {
        throw new Error(t('Invalid derivation path'));
      }

      if (
        !isValidDerivationPathCoin(advancedOpts.derivationPath, keyOpts.coin)
      ) {
        throw new Error(t('Invalid derivation path for selected coin'));
      }
    }
  };

  const onSubmit = (formData: {text: string}) => {
    const {text} = formData;
    let keyOpts: Partial<KeyOptions> = {};
    keyOpts.includeTestnetWallets = includeTestnetWallets;
    keyOpts.includeLegacyWallets = includeLegacyWallets;
    // console.log("---------- 导入观察钱包 - 点提交后的数据: ", JSON.stringify(formData), JSON.stringify(advancedOptions), JSON.stringify(keyOpts));
    try {

      if(!isValidPhrasePublicKey(text)){
        logger.error('---------- 公钥有误，请检查');
        showErrorModal(new Error(t('The public key is invalid.')));
        return;
      }
      setKeyOptions(keyOpts, advancedOptions);
    } catch (e: any) {
      logger.error(e.message);
      showErrorModal(e);
      return;
    }
    // console.log("---------- 使用公钥导入", text);
    const xPublicKey = text;
    importWallet({xPublicKey}, keyOpts);
  };

  const importWallet = async (
    importData: {xPublicKey: string},
    opts: Partial<KeyOptions>,
  ): Promise<void> => {
    try {
      // console.log("---------- 使用公钥导入观察钱包 importData opts", JSON.stringify(importData), JSON.stringify(opts));
      dispatch(startOnGoingProcessModal('IMPORTING')); // 开始转圈
      await sleep(1000);
      // 目标是导入一个只读钱包，使用公钥导入 
      const key = ((await dispatch<any>(startImportPublicKey(importData, opts))) as Key);
      // console.log("---------- 执行完毕startImportFileTest 最后的key = ", JSON.stringify(key));
      await dispatch(startGetRates({}));
      await dispatch(startUpdateAllWalletStatusForKey({key, force: true}));
      await dispatch(updatePortfolioBalance());
      dispatch(setHomeCarouselConfig({id: key.id, show: true}));
      backupRedirect({
        context: route.params?.context,
        navigation,
        walletTermsAccepted,
        key,
      });
      dispatch(
        Analytics.track('Imported PubKey', {
          context: route.params?.context || '',
          source: 'RecoveryPubKey',
        }),
      );
      dispatch(dismissOnGoingProcessModal()); // 转圈结束
    } catch (e: any) {
      logger.error(e.message);
      dispatch(dismissOnGoingProcessModal());
      await sleep(600);
      showErrorModal(e);
      return;
    }
  };

  // const setOptsAndCreate = async (
  //   text: string,
  //   advancedOpts: {
  //     derivationPath: string;
  //     coin: string;
  //     chain: string;
  //     passphrase: string | undefined;
  //     isMultisig: boolean;
  //   },
  // ): Promise<void> => {
  //   try {
  //     let keyOpts: Partial<KeyOptions> = {
  //       name: dispatch(GetName(advancedOpts.coin!, advancedOpts.chain)),
  //     };

  //     try {
  //       setKeyOptions(keyOpts, advancedOpts);
  //     } catch (e: any) {
  //       logger.error(e.message);
  //       showErrorModal(e);
  //       return;
  //     }

  //     if (text.includes('xprv') || text.includes('tprv')) {
  //       keyOpts.extendedPrivateKey = text;
  //       keyOpts.seedType = 'extendedPrivateKey';
  //     } else {
  //       keyOpts.mnemonic = text;
  //       keyOpts.seedType = 'mnemonic';
  //       if (!isValidPhrasePublicKey(text)) {
  //         logger.error('Incorrect words length');
  //         showErrorModal(new Error(t('The recovery phrase is invalid.')));
  //         return;
  //       }
  //     }

  //     await dispatch(startOnGoingProcessModal('CREATING_KEY'));

  //     const key = (await dispatch<any>(startCreateKeyWithOpts(keyOpts))) as Key;
  //     await dispatch(startGetRates({}));
  //     await dispatch(startUpdateAllWalletStatusForKey({key, force: true}));
  //     await sleep(1000);
  //     await dispatch(updatePortfolioBalance());

  //     dispatch(setHomeCarouselConfig({id: key.id, show: true}));

  //     backupRedirect({
  //       context: route.params?.context,
  //       navigation,
  //       walletTermsAccepted,
  //       key,
  //     });
  //     dispatch(dismissOnGoingProcessModal());
  //     setRecreateWallet(false);
  //   } catch (e: any) {
  //     logger.error(e.message);
  //     dispatch(dismissOnGoingProcessModal());
  //     await sleep(500);
  //     showErrorModal(e);
  //     setRecreateWallet(false);
  //     return;
  //   }
  // };


  /**
   * 使用公钥导入，找不到用户后重新创建
   * @param text 公钥信息
   * @param advancedOpts 
   * @returns 
   */
  const setOptsAndCreateWithPubKey = async (
    text: string,
    advancedOpts: {
      derivationPath: string;
      coin: string;
      chain: string;
      passphrase: string | undefined;
      isMultisig: boolean;
    },
  ): Promise<void> => {
    try {
      let keyOpts: Partial<KeyOptions> = {
        name: dispatch(GetName(advancedOpts.coin!, advancedOpts.chain)),
      };

      try {
        setKeyOptions(keyOpts, advancedOpts);
      } catch (e: any) {
        logger.error(e.message);
        showErrorModal(e);
        return;
      }

      if (text.includes('xpub') || text.includes('tpub')) {
        keyOpts.extendedPublicKey = text;
        keyOpts.seedType = 'extendedPublicKey';
      } else {
        logger.error(`---------- 公钥有误，请检查: pubkey = [${text}]`);
        showErrorModal(new Error(t('The public key is invalid.')));
        return;
      }

      await dispatch(startOnGoingProcessModal('CREATING_KEY'));
      const key = (await dispatch<any>(startCreateKeyWithOptsNew(keyOpts))) as Key;
      // console.log('----------  初次创建key', JSON.stringify(key));
      await dispatch(startGetRates({}));
      await dispatch(startUpdateAllWalletStatusForKey({key, force: true}));
      await sleep(1000);
      await dispatch(updatePortfolioBalance());

      dispatch(setHomeCarouselConfig({id: key.id, show: true}));
      // console.log('----------  公钥导入钱包创建完毕， 跳转参数：route.params?.context， navigation， walletTermsAccepted， key', JSON.stringify(route.params?.context), JSON.stringify(navigation), JSON.stringify(walletTermsAccepted), JSON.stringify(key));
      backupRedirect({
        context: route.params?.context,
        navigation,
        walletTermsAccepted,
        key,
      });
      dispatch(dismissOnGoingProcessModal());
      setRecreateWallet(false);
    } catch (e: any) {
      logger.error(e.message);
      dispatch(dismissOnGoingProcessModal());
      await sleep(500);
      showErrorModal(e);
      setRecreateWallet(false);
      return;
    }
  };

  const renderItem = useCallback(
    ({item}) => {
      const currencySelected = (id: string) => {
        const _selectedCurrency = CurrencyOptions.filter(
          currency => currency.currencyAbbreviation === id,
        );
        const currencyAbbreviation = _selectedCurrency[0].currencyAbbreviation;
        const defaultCoin = `default${currencyAbbreviation.toUpperCase()}`;
        // @ts-ignore
        const derivationPath = DefaultDerivationPath[defaultCoin];
        setSelectedCurrency(_selectedCurrency[0]);
        setCurrencyModalVisible(false);
        const advancedOpts = {
          ...advancedOptions,
          coin: currencyAbbreviation,
          chain: currencyAbbreviation, // chain = currency for all currencies if tokens not included
          derivationPath,
        };
        setAdvancedOptions(advancedOpts);

        // is trying to create wallet in bws
        if (recreateWallet) {
          const {text} = getValues();
          console.warn(`---------- 进入RecreateWallet方法  text = [${text}],  advancedOpts = [${advancedOpts}]`);
          setOptsAndCreateWithPubKey(text, advancedOpts);
        }
      };

      return (
        <CurrencySelectionRow
          currency={item}
          onToggle={currencySelected}
          key={item.id}
          hideCheckbox={true}
        />
      );
    },
    [
      setSelectedCurrency,
      setCurrencyModalVisible,
      setAdvancedOptions,
      advancedOptions,
      recreateWallet,
      setRecreateWallet,
    ],
  );

  useEffect(() => {
    if (route.params?.importQrCodeData) {
      processImportQrCode(route.params.importQrCodeData);
    }
  }, []);

  return (
    <ScrollViewContainer
      extraScrollHeight={90}
      keyboardShouldPersistTaps={'handled'}>
      <ContentView keyboardShouldPersistTaps={'handled'}>
        <Paragraph>
          {t(
            'Use an existing public key to import an existing watch wallet',
          )}
        </Paragraph>

        <HeaderContainer>
          <ImportTitle>{t('Public Key')}</ImportTitle>

          <ScanContainer
            activeOpacity={ActiveOpacity}
            onPress={() => {
              dispatch(
                Analytics.track('Open Scanner', {
                  context: 'RecoveryPubKey',
                }),
              );
              navigation.navigate('Scan', {
                screen: 'Root',
                params: {
                  onScanComplete: data => {
                    processImportQrCode(data);
                  },
                },
              });
            }}>
            <ScanSvg />
          </ScanContainer>
        </HeaderContainer>

        <Controller
          control={control}
          render={({field: {onChange, onBlur, value}}) => (
            <ImportTextInput
              multiline
              autoCapitalize={'none'}
              numberOfLines={3}
              onChangeText={(text: string) => onChange(text)}
              onBlur={onBlur}
              value={value}
              autoCorrect={false}
              spellCheck={false}
              textContentType={'password'}
            />
          )}
          name="text"
          defaultValue=""
        />

        {errors.text?.message && <ErrorText>{errors.text.message}</ErrorText>}

        <CuationText>
          {t('This process may take a few minutes to complete.')}
        </CuationText>
        <CtaContainer>
          <AdvancedOptionsContainer>
            <AdvancedOptionsButton
              onPress={() => {
                Haptic('impactLight');
                setShowAdvancedOptions(!showAdvancedOptions);
              }}>
              {showAdvancedOptions ? (
                <>
                  <AdvancedOptionsButtonText>
                    {t('Hide Advanced Options')}
                  </AdvancedOptionsButtonText>
                  <ChevronUpSvg />
                </>
              ) : (
                <>
                  <AdvancedOptionsButtonText>
                    {t('Show Advanced Options')}
                  </AdvancedOptionsButtonText>
                  <ChevronDownSvg />
                </>
              )}
            </AdvancedOptionsButton>

            {showAdvancedOptions && !derivationPathEnabled && (
              <AdvancedOptions>
                <RowContainer
                  activeOpacity={1}
                  onPress={() => {
                    setIncludeTestnetWallets(!includeTestnetWallets);
                  }}>
                  <Column>
                    <OptionTitle>{t('Include Testnet Wallets')}</OptionTitle>
                  </Column>
                  <CheckBoxContainer>
                    <Checkbox
                      checked={includeTestnetWallets}
                      onPress={() => {
                        setIncludeTestnetWallets(!includeTestnetWallets);
                      }}
                    />
                  </CheckBoxContainer>
                </RowContainer>
              </AdvancedOptions>
            )}

            {showAdvancedOptions && !derivationPathEnabled && (
              <AdvancedOptions>
                <RowContainer
                  activeOpacity={1}
                  onPress={() => {
                    setIncludeLegacyWallets(!includeLegacyWallets);
                  }}>
                  <Column>
                    <OptionTitle>{t('Include Legacy Wallets')}</OptionTitle>
                  </Column>
                  <CheckBoxContainer>
                    <Checkbox
                      checked={includeLegacyWallets}
                      onPress={() => {
                        setIncludeLegacyWallets(!includeLegacyWallets);
                      }}
                    />
                  </CheckBoxContainer>
                </RowContainer>
              </AdvancedOptions>
            )}

            {showAdvancedOptions && (
              <AdvancedOptions>
                <RowContainer
                  activeOpacity={1}
                  onPress={() => {
                    setDerivationPathEnabled(!derivationPathEnabled);
                  }}>
                  <Column>
                    <OptionTitle>{t('Specify Derivation Path')}</OptionTitle>
                  </Column>
                  <CheckBoxContainer>
                    <Checkbox
                      checked={derivationPathEnabled}
                      onPress={() => {
                        setDerivationPathEnabled(!derivationPathEnabled);
                      }}
                    />
                  </CheckBoxContainer>
                </RowContainer>
              </AdvancedOptions>
            )}

            {showAdvancedOptions && derivationPathEnabled && (
              <AdvancedOptions>
                <CurrencySelectorContainer>
                  <Label>{t('CURRENCY')}</Label>
                  <CurrencyContainer
                    activeOpacity={ActiveOpacity}
                    onPress={() => {
                      setCurrencyModalVisible(true);
                    }}>
                    <Row
                      style={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                      <Row style={{alignItems: 'center'}}>
                        <CurrencyImage img={selectedCurrency.img} size={30} />
                        <CurrencyName>
                          {selectedCurrency?.currencyAbbreviation?.toUpperCase()}
                        </CurrencyName>
                      </Row>
                      <Icons.DownToggle />
                    </Row>
                  </CurrencyContainer>
                </CurrencySelectorContainer>
              </AdvancedOptions>
            )}

            <SheetModal
              isVisible={currencyModalVisible}
              onBackdropPress={() => setCurrencyModalVisible(false)}>
              <CurrencySelectionModalContainer>
                <TextAlign align={'center'}>
                  <H4>{t('Select a Coin')}</H4>
                </TextAlign>
                <FlatList
                  contentContainerStyle={{paddingTop: 20, paddingBottom: 20}}
                  data={CurrencyOptions}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                />
              </CurrencySelectionModalContainer>
            </SheetModal>

            {showAdvancedOptions && derivationPathEnabled && (
              <AdvancedOptions>
                <InputContainer>
                  <BoxInput
                    label={'DERIVATION PATH'}
                    onChangeText={(text: string) =>
                      setAdvancedOptions({
                        ...advancedOptions,
                        derivationPath: text,
                      })
                    }
                    value={advancedOptions.derivationPath}
                  />
                </InputContainer>
              </AdvancedOptions>
            )}
          </AdvancedOptionsContainer>
        </CtaContainer>

        <Button buttonStyle={'primary'} onPress={handleSubmit(onSubmit)}>
          {t('Import Watch Wallet')}
        </Button>
      </ContentView>
    </ScrollViewContainer>
  );
};

export default RecoveryPubKey;
