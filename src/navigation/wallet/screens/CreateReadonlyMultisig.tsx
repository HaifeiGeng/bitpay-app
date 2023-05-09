import React, {useState} from 'react';
import {TouchableOpacity} from 'react-native';
import styled from 'styled-components/native';
import {Caution, SlateDark, White, Action, Slate} from '../../../styles/colors';
import {
  Paragraph,
  BaseText,
  Link,
  InfoTitle,
  InfoHeader,
  InfoDescription,
} from '../../../components/styled/Text';
import Button from '../../../components/button/Button';
import {
  showBottomNotificationModal,
  dismissOnGoingProcessModal,
  setHomeCarouselConfig,
} from '../../../store/app/app.actions';
import {yupResolver} from '@hookform/resolvers/yup';
import yup from '../../../lib/yup';
import {useForm, Controller} from 'react-hook-form';
import BoxInput from '../../../components/form/BoxInput';
import {useLogger} from '../../../utils/hooks/useLogger';
import {KeyOptions, Status} from '../../../store/wallet/wallet.models';
import {
  RouteProp,
  useNavigation,
  useRoute,
  CommonActions,
} from '@react-navigation/native';
import {
  Info,
  InfoTriangle,
  AdvancedOptionsContainer,
  AdvancedOptionsButton,
  AdvancedOptionsButtonText,
  AdvancedOptions,
  Column,
  ScreenGutter,
  CtaContainer as _CtaContainer,
  InfoImageContainer,
} from '../../../components/styled/Containers';
import Haptic from '../../../components/haptic-feedback/haptic';
import ChevronDownSvg from '../../../../assets/img/chevron-down.svg';
import ChevronUpSvg from '../../../../assets/img/chevron-up.svg';
import {BitpaySupportedCurrencies} from '../../../constants/currencies';
import Checkbox from '../../../components/checkbox/Checkbox';
import {WalletStackParamList} from '../WalletStack';
import {openUrlWithInAppBrowser} from '../../../store/app/app.effects';
import {
  startCreateKeyMultisig,
  startCreateReadonlyKeyMultisig,
  addReadonlyWalletMultisig,
  getDecryptPassword,
} from '../../../store/wallet/effects';
import {startOnGoingProcessModal} from '../../../store/app/app.effects';
import InfoSvg from '../../../../assets/img/info.svg';
import PlusIcon from '../../../components/plus/Plus';
import MinusIcon from '../../../components/minus/Minus';
import {sleep} from '../../../utils/helper-methods';
import {Key, Wallet} from '../../../store/wallet/wallet.models';
import {WrongPasswordError} from '../components/ErrorMessages';
import {URL} from '../../../constants';
import {useAppDispatch} from '../../../utils/hooks';
import {useTranslation} from 'react-i18next';
import {Analytics} from '../../../store/analytics/analytics.effects';

import ScanSvg from '../../../../assets/img/onboarding/scan.svg';

import {ImportObj} from '../../../store/scan/scan.models';
import {backupRedirect} from '../screens/Backup';


import {
  ActiveOpacity,
  HeaderContainer,
  ScanContainer,
  ImportTextInput,
} from '../../../components/styled/Containers';

import {
  ImportTitle,
} from '../../../components/styled/Text';

import {useSelector} from 'react-redux';
import {RootState} from '../../../store';

export interface CreateReadonlyMultisigProps {
  currency: string;
  key: Key;
}

const schema = yup.object().shape({
  name: yup.string().required(),
  myName: yup.string().required(),
  requiredSignatures: yup
    .number()
    .required()
    .positive()
    .integer()
    .min(1)
    .max(3), // m
  totalCopayers: yup.number().required().positive().integer().min(2).max(6), // n
});

const Gutter = '10px';
export const MultisigContainer = styled.View`
  padding: ${Gutter} 0;
`;

const ScrollViewContainer = styled.ScrollView`
  margin-top: 20px;
  padding: 0 15px;
`;

const ErrorText = styled(BaseText)`
  color: ${Caution};
  font-size: 12px;
  font-weight: 500;
  padding: 5px 0 0 0;
`;

const CheckBoxContainer = styled.View`
  flex-direction: column;
  justify-content: center;
`;

const OptionTitle = styled(BaseText)`
  font-size: 16px;
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const VerticalPadding = styled.View`
  padding: ${ScreenGutter} 0;
`;

const OptionContainer = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const CounterContainer = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const RoundButton = styled.View`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin: 10px;
  border-radius: 30px;
  border: 1px solid ${({theme: {dark}}) => (dark ? White : Action)};
`;

const RemoveButton = styled.TouchableOpacity`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 30px;
  border: 1px solid ${Slate};
`;

const AddButton = styled.TouchableOpacity`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  width: 20px;
  border: 1px solid black;
  border-radius: 30px;
  border: 1px solid ${({theme: {dark}}) => (dark ? White : Action)};
`;

const CounterNumber = styled.Text`
  color: ${({theme: {dark}}) => (dark ? White : Action)};
  font-size: 16px;
`;

const RowContainer = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 18px;
`;

const InputContainer = styled.View`
  margin-top: 20px;
`;

const CtaContainer = styled(_CtaContainer)`
  padding: 10px 0;
`;

const CreateReadonlyMultisig = () => {
  const walletTermsAccepted = useSelector(
    ({WALLET}: RootState) => WALLET.walletTermsAccepted,
  );
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const logger = useLogger();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<WalletStackParamList, 'CreateReadonlyMultisig'>>();
  const {currency, key} = route.params;
  const segwitSupported = ['btc', 'ltc'].includes(currency.toLowerCase());
  const [showOptions, setShowOptions] = useState(false);
  const [testnetEnabled, setTestnetEnabled] = useState(false);
  const [options, setOptions] = useState({
    useNativeSegwit: false,
    networkName: 'livenet',
    singleAddress: false,
  });
  const {
    control,
    handleSubmit,
    setValue,
    formState: {errors},
  } = useForm({resolver: yupResolver(schema)});

  const singleAddressCurrency =
    BitpaySupportedCurrencies[currency?.toLowerCase() as string]?.properties
      ?.singleAddress;

  const showErrorModal = (e: string) => {
    dispatch(
      showBottomNotificationModal({
        type: 'warning',
        title: t('Something went wrong'),
        message: e,
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
  };

  const onSubmit = (formData: {
    name: string;
    myName: string;
    requiredSignatures: number;
    totalCopayers: number;
    pubKey: string;
  }) => {
    const {name, myName, requiredSignatures, totalCopayers, pubKey} = formData;

    let opts: Partial<KeyOptions> = {};
    opts.name = name;
    opts.myName = myName;
    opts.m = requiredSignatures;
    opts.n = totalCopayers;
    opts.useNativeSegwit = options.useNativeSegwit;
    opts.networkName = options.networkName;
    opts.singleAddress = options.singleAddress;
    opts.coin = currency?.toLowerCase();
    // 使用公钥创建多签钱包
    opts.extendedPublicKey = pubKey;
    // console.log('---------- 多签 创建多签，提交按钮， 参数: ', JSON.stringify(key),JSON.stringify(opts));
    CreateReadonlyMultisigWallet(opts);
  };

  const CreateReadonlyMultisigWallet = async (
    opts: Partial<KeyOptions>,
  ): Promise<void> => {
    try {
      if (key) {
        // console.log('---------- 进入if: ', JSON.stringify(key));
        if (key.isPrivKeyEncrypted) {
          opts.password = await dispatch(getDecryptPassword(key));
        }

        await dispatch(startOnGoingProcessModal('ADDING_WALLET'));
        const wallet = (await dispatch<any>(
          addReadonlyWalletMultisig({
            key,
            opts,
          }),
        )) as Wallet;
        // console.log('---------- 进入if 多签 : ', JSON.stringify(wallet));
        dispatch(
          Analytics.track('Created Multisig Wallet', {
            coin: currency?.toLowerCase(),
            type: `${opts.m}-${opts.n}`,
            addedToExistingKey: true,
          }),
        );

        wallet.getStatus(
          {network: wallet.network},
          (err: any, status: Status) => {
            if (err) {
              navigation.dispatch(
                CommonActions.reset({
                  index: 1,
                  routes: [
                    {
                      name: 'Tabs',
                      params: {screen: 'Home'},
                    },
                    {
                      name: 'Wallet',
                      params: {screen: 'KeyOverview', params: {id: key.id}},
                    },
                  ],
                }),
              );
            } else {
              navigation.dispatch(
                CommonActions.reset({
                  index: 2,
                  routes: [
                    {
                      name: 'Tabs',
                      params: {screen: 'Home'},
                    },
                    {
                      name: 'Wallet',
                      params: {screen: 'KeyOverview', params: {id: key.id}},
                    },
                    {
                      name: 'Wallet',
                      params: {
                        screen: 'Copayers',
                        params: {wallet: wallet, status: status.wallet},
                      },
                    },
                  ],
                }),
              );
            }
            dispatch(dismissOnGoingProcessModal());
          },
        );
      } else {
        // console.log('---------- 进入else: ', JSON.stringify(opts));

        await dispatch(startOnGoingProcessModal('CREATING_KEY'));
        const multisigKey = (await dispatch<any>(
          startCreateReadonlyKeyMultisig(opts),
        )) as Key;

        dispatch(
          Analytics.track('Created Multisig Wallet', {
            coin: currency?.toLowerCase(),
            type: `${opts.m}-${opts.n}`,
            addedToExistingKey: false,
          }),
        );

        dispatch(
          Analytics.track('Created Key', {
            context: 'createMultisig',
            coins: [currency?.toLowerCase()],
          }),
        );

        dispatch(setHomeCarouselConfig({id: multisigKey.id, show: true}));
        backupRedirect({
          context: 'createNewMultisigKey',
          navigation,
          walletTermsAccepted: true,
          key: multisigKey,
        });
        dispatch(dismissOnGoingProcessModal());
      }
    } catch (e: any) {
      logger.error(e.message);
      if (e.message === 'invalid password') {
        dispatch(showBottomNotificationModal(WrongPasswordError()));
      } else {
        dispatch(dismissOnGoingProcessModal());
        await sleep(500);
        showErrorModal(e.message);
        return;
      }
    }
  };

  const toggleTestnet = () => {
    const _testnetEnabled = !testnetEnabled;
    setTestnetEnabled(_testnetEnabled);
    setOptions({
      ...options,
      networkName: _testnetEnabled ? 'testnet' : 'livenet',
    });
  };

  const processImportQrCode = (code: string): void => {
    try {
      console.log('扫码信息：', JSON.stringify(code));
      if(!code){
        console.error('扫码导入公钥出现空值...');
        return;
      }
      if (!code.startsWith('xpub') && !code.startsWith('tpub')) {
        showErrorModal(t('The public key is invalid.'));
        return;
      }
      setValue('pubKey', code);
    } catch (err) {
      showErrorModal(t('The public key is invalid.'));
    }
  };

  return (
    <ScrollViewContainer>
      <MultisigContainer>
        <Paragraph>
          {t(
            "Multisig wallets require multisig devices to set up. It takes longer to complete but it's the recommended security configuration for long term storage.",
          )}
        </Paragraph>

        <InputContainer>
          <Controller
            control={control}
            render={({field: {onChange, onBlur, value}}) => (
              <BoxInput
                label={t('WALLET NAME')}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
              />
            )}
            name="name"
            defaultValue=""
          />
        </InputContainer>

        <InputContainer>
          <Controller
            control={control}
            render={({field: {onChange, onBlur, value}}) => (
              <BoxInput
                label={t('YOUR NAME')}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.myName?.message}
              />
            )}
            name="myName"
            defaultValue=""
          />
        </InputContainer>

        <HeaderContainer>
          <ImportTitle>{t('Public Key')}</ImportTitle>

          <ScanContainer
            activeOpacity={ActiveOpacity}
            onPress={() => {
              dispatch(
                Analytics.track('Open Scanner', {
                  context: 'RecoveryColdWallet',
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
          name="pubKey"
          defaultValue=""
        />

        <Controller
          control={control}
          render={({field: {value}}) => (
            <>
              <OptionContainer>
                <OptionTitle>{t('Required number of signatures')}</OptionTitle>
                <CounterContainer>
                  <RemoveButton
                    onPress={() => {
                      const newValue = value - 1;
                      if (newValue >= 1) {
                        setValue('requiredSignatures', newValue, {
                          shouldValidate: true,
                        });
                      }
                    }}>
                    <MinusIcon />
                  </RemoveButton>
                  <RoundButton>
                    <CounterNumber>{value}</CounterNumber>
                  </RoundButton>
                  <AddButton
                    onPress={() => {
                      const newValue = value + 1;
                      if (newValue <= 3) {
                        setValue('requiredSignatures', newValue, {
                          shouldValidate: true,
                        });
                      }
                    }}>
                    <PlusIcon />
                  </AddButton>
                </CounterContainer>
              </OptionContainer>
            </>
          )}
          name="requiredSignatures"
          defaultValue={2}
        />

        {errors?.requiredSignatures?.message && (
          <ErrorText>{errors?.requiredSignatures?.message}</ErrorText>
        )}

        <Controller
          control={control}
          render={({field: {value}}) => (
            <OptionContainer>
              <Column>
                <OptionTitle>{t('Total number of copayers')}</OptionTitle>
              </Column>
              <CounterContainer>
                <RemoveButton
                  onPress={() => {
                    const newValue = value - 1;
                    if (newValue >= 2) {
                      setValue('totalCopayers', newValue, {
                        shouldValidate: true,
                      });
                    }
                  }}>
                  <MinusIcon />
                </RemoveButton>
                <RoundButton>
                  <CounterNumber>{value}</CounterNumber>
                </RoundButton>
                <AddButton
                  onPress={() => {
                    const newValue = value + 1;
                    if (newValue <= 6) {
                      setValue('totalCopayers', newValue, {
                        shouldValidate: true,
                      });
                    }
                  }}>
                  <PlusIcon />
                </AddButton>
              </CounterContainer>
            </OptionContainer>
          )}
          name="totalCopayers"
          defaultValue={2}
        />

        {errors?.totalCopayers?.message && (
          <ErrorText>{errors?.totalCopayers?.message}</ErrorText>
        )}

        <CtaContainer>
          <AdvancedOptionsContainer>
            <AdvancedOptionsButton
              onPress={() => {
                Haptic('impactLight');
                setShowOptions(!showOptions);
              }}>
              {showOptions ? (
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

            {showOptions && segwitSupported && (
              <AdvancedOptions>
                <RowContainer
                  onPress={() => {
                    setOptions({
                      ...options,
                      useNativeSegwit: !options.useNativeSegwit,
                    });
                  }}>
                  <Column>
                    <OptionTitle>Segwit</OptionTitle>
                  </Column>
                  <CheckBoxContainer>
                    <Checkbox
                      checked={options.useNativeSegwit}
                      onPress={() => {
                        setOptions({
                          ...options,
                          useNativeSegwit: !options.useNativeSegwit,
                        });
                      }}
                    />
                  </CheckBoxContainer>
                </RowContainer>
              </AdvancedOptions>
            )}
            {showOptions && (
              <AdvancedOptions>
                <RowContainer onPress={toggleTestnet}>
                  <Column>
                    <OptionTitle>Testnet</OptionTitle>
                  </Column>
                  <CheckBoxContainer>
                    <Checkbox
                      checked={testnetEnabled}
                      onPress={toggleTestnet}
                    />
                  </CheckBoxContainer>
                </RowContainer>
              </AdvancedOptions>
            )}

            {showOptions && !singleAddressCurrency && (
              <AdvancedOptions>
                <RowContainer
                  activeOpacity={1}
                  onPress={() => {
                    setOptions({
                      ...options,
                      singleAddress: !options.singleAddress,
                    });
                  }}>
                  <Column>
                    <OptionTitle>{t('Single Address')}</OptionTitle>
                  </Column>
                  <CheckBoxContainer>
                    <Checkbox
                      checked={options.singleAddress}
                      onPress={() => {
                        setOptions({
                          ...options,
                          singleAddress: !options.singleAddress,
                        });
                      }}
                    />
                  </CheckBoxContainer>
                </RowContainer>

                {options.singleAddress && (
                  <>
                    <Info style={{marginHorizontal: 10}}>
                      <InfoTriangle />

                      <InfoHeader>
                        <InfoImageContainer infoMargin={'0 8px 0 0'}>
                          <InfoSvg />
                        </InfoImageContainer>

                        <InfoTitle>{t('Single Address Wallet')}</InfoTitle>
                      </InfoHeader>
                      <InfoDescription>
                        {t(
                          'The single address feature will force the wallet to only use one address rather than generating new addresses.',
                        )}
                      </InfoDescription>

                      <VerticalPadding>
                        <TouchableOpacity
                          onPress={() => {
                            Haptic('impactLight');
                            dispatch(
                              openUrlWithInAppBrowser(URL.HELP_SINGLE_ADDRESS),
                            );
                          }}>
                          <Link>{t('Learn More')}</Link>
                        </TouchableOpacity>
                      </VerticalPadding>
                    </Info>
                  </>
                )}
              </AdvancedOptions>
            )}
          </AdvancedOptionsContainer>
        </CtaContainer>

        <CtaContainer>
          <Button buttonStyle={'primary'} onPress={handleSubmit(onSubmit)}>
            {t('Create Readonly Wallet')}
          </Button>
        </CtaContainer>
      </MultisigContainer>
    </ScrollViewContainer>
  );
};

export default CreateReadonlyMultisig;
