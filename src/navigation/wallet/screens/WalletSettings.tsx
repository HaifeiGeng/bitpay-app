import React, {useLayoutEffect} from 'react';
import {BaseText, HeaderTitle} from '../../../components/styled/Text';
import {useNavigation, useRoute} from '@react-navigation/native';
import {RouteProp} from '@react-navigation/core';
import {WalletStackParamList} from '../WalletStack';
import {View} from 'react-native';
import styled from 'styled-components/native';
import {
  ActiveOpacity,
  Hr,
  Info,
  InfoTriangle,
  ScreenGutter,
  Setting,
  SettingTitle,
  SettingView,
} from '../../../components/styled/Containers';
import ChevronRightSvg from '../../../../assets/img/angle-right.svg';
import haptic from '../../../components/haptic-feedback/haptic';

import {SlateDark, White} from '../../../styles/colors';
import ToggleSwitch from '../../../components/toggle-switch/ToggleSwitch';
import {useAppSelector} from '../../../utils/hooks';
import {findWalletById} from '../../../store/wallet/utils/wallet';
import {Wallet} from '../../../store/wallet/wallet.models';
import {AppActions} from '../../../store/app';
import {sleep} from '../../../utils/helper-methods';
import {
  showBottomNotificationModal,
  showDecryptPasswordModal,
} from '../../../store/app/app.actions';
import {WrongPasswordError} from '../components/ErrorMessages';
import {useDispatch} from 'react-redux';
import {
  toggleHideBalance,
  toggleHideWallet,
  updatePortfolioBalance,
} from '../../../store/wallet/wallet.actions';
import {startUpdateWalletBalance} from '../../../store/wallet/effects/balance/balance';

const WalletSettingsContainer = styled.SafeAreaView`
  flex: 1;
`;

const ScrollView = styled.ScrollView`
  margin-top: 20px;
  padding: 0 ${ScreenGutter};
`;

const Title = styled(BaseText)`
  font-weight: bold;
  font-size: 18px;
  margin: 5px 0;
  color: ${({theme}) => theme.colors.text};
`;

const WalletNameContainer = styled.TouchableOpacity`
  padding: 10px 0 20px 0;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const InfoDescription = styled(BaseText)`
  font-size: 16px;
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const VerticalPadding = styled.View`
  padding: ${ScreenGutter} 0;
`;

const WalletSettingsTitle = styled(SettingTitle)`
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

const WalletSettings = () => {
  const {
    params: {walletId, key},
  } = useRoute<RouteProp<WalletStackParamList, 'WalletSettings'>>();
  const navigation = useNavigation();

  const wallets = useAppSelector(({WALLET}) => WALLET.keys[key.id].wallets);
  const wallet = findWalletById(wallets, walletId) as Wallet;
  const {
    walletName,
    credentials: {walletName: credentialsWalletName},
    hideWallet,
    hideBalance,
  } = wallet;

  const dispatch = useDispatch();

  const buildEncryptModalConfig = (
    cta: (decryptedKey: {
      mnemonicHasPassphrase: boolean;
      mnemonic: string;
      xPrivKey: string;
    }) => void,
  ) => {
    return {
      onSubmitHandler: async (encryptPassword: string) => {
        try {
          const decryptedKey = key.methods.get(encryptPassword);
          dispatch(AppActions.dismissDecryptPasswordModal());
          await sleep(300);
          cta(decryptedKey);
        } catch (e) {
          console.log(`Decrypt Error: ${e}`);
          await dispatch(AppActions.dismissDecryptPasswordModal());
          await sleep(500); // Wait to close Decrypt Password modal
          dispatch(showBottomNotificationModal(WrongPasswordError()));
        }
      },
      description: 'To continue please enter your encryption password.',
      onCancelHandler: () => null,
    };
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HeaderTitle>Wallet Settings</HeaderTitle>,
    });
  });
  return (
    <WalletSettingsContainer>
      <ScrollView>
        <WalletNameContainer
          activeOpacity={ActiveOpacity}
          onPress={() => {
            haptic('impactLight');
            navigation.navigate('Wallet', {
              screen: 'UpdateKeyOrWalletName',
              params: {
                key,
                wallet: {
                  walletId,
                  walletName: walletName || credentialsWalletName,
                },
                context: 'wallet',
              },
            });
          }}>
          <View>
            <Title>Name</Title>
            <WalletSettingsTitle>
              {walletName || credentialsWalletName}
            </WalletSettingsTitle>
          </View>

          <ChevronRightSvg height={16} />
        </WalletNameContainer>

        <Hr />

        <SettingView>
          <WalletSettingsTitle>Hide Wallet</WalletSettingsTitle>

          <ToggleSwitch
            onChange={() => {
              haptic('impactLight');
              dispatch(toggleHideWallet({wallet}));
              dispatch(startUpdateWalletBalance({key, wallet}));
              dispatch(updatePortfolioBalance());
            }}
            isEnabled={!!hideWallet}
          />
        </SettingView>
        {!hideWallet ? (
          <Info>
            <InfoTriangle />
            <InfoDescription>
              This wallet will not be removed from the device.
            </InfoDescription>
          </Info>
        ) : null}

        <SettingView>
          <WalletSettingsTitle>Hide Balance</WalletSettingsTitle>

          <ToggleSwitch
            onChange={() => {
              haptic('impactLight');
              dispatch(toggleHideBalance({wallet}));
            }}
            isEnabled={!!hideBalance}
          />
        </SettingView>

        <Hr />

        <VerticalPadding>
          <Title>Security</Title>

          <SettingView>
            <WalletSettingsTitle>
              Request Biometric Authentication
            </WalletSettingsTitle>
            <ToggleSwitch
              onChange={() => {
                haptic('impactLight');
                //    TODO: Update me
              }}
              isEnabled={false}
            />
          </SettingView>

          <Hr />
        </VerticalPadding>

        <VerticalPadding>
          <Title>Advanced</Title>
          <Setting
            activeOpacity={ActiveOpacity}
            onPress={() => {
              haptic('impactLight');
              navigation.navigate('Wallet', {
                screen: 'WalletInformation',
                params: {wallet},
              });
            }}>
            <WalletSettingsTitle>Information</WalletSettingsTitle>
          </Setting>
          <Hr />

          <Setting
            activeOpacity={ActiveOpacity}
            onPress={() => {
              haptic('impactLight');
              navigation.navigate('Wallet', {
                screen: 'Addresses',
                params: {wallet},
              });
            }}>
            <WalletSettingsTitle>Addresses</WalletSettingsTitle>
          </Setting>
          <Hr />

          <Setting
            activeOpacity={ActiveOpacity}
            onPress={() => {
              haptic('impactLight');
              if (key.methods.isPrivKeyEncrypted()) {
                dispatch(
                  showDecryptPasswordModal(
                    buildEncryptModalConfig(async decryptedKey => {
                      navigation.navigate('Wallet', {
                        screen: 'ExportWallet',
                        params: {
                          wallet,
                          keyObj: decryptedKey,
                        },
                      });
                    }),
                  ),
                );
              } else {
                navigation.navigate('Wallet', {
                  screen: 'ExportWallet',
                  params: {wallet, keyObj: key.methods.get()},
                });
              }
            }}>
            <WalletSettingsTitle>Export Wallet</WalletSettingsTitle>
          </Setting>
        </VerticalPadding>
      </ScrollView>
    </WalletSettingsContainer>
  );
};

export default WalletSettings;
