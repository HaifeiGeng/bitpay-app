import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {Key} from '../../../store/wallet/wallet.models';
import OptionsSheet, {Option} from '../components/OptionsSheet';
import {useThemeType} from '../../../utils/hooks/useThemeType';
import {useTranslation} from 'react-i18next';
import {useAppDispatch} from '../../../utils/hooks';
import {Analytics} from '../../../store/analytics/analytics.effects';

const MultisigSharedOptionImage = {
  light: require('../../../../assets/img/wallet/wallet-type/add-multisig.png'),
  dark: require('../../../../assets/img/wallet/wallet-type/add-multisig-dark.png'),
};

const MultisigJoinOptionImage = {
  light: require('../../../../assets/img/wallet/wallet-type/add-join.png'),
  dark: require('../../../../assets/img/wallet/wallet-type/add-join-dark.png'),
};

export interface MultisigOptionsProps {
  setShowMultisigOptions: (value: boolean) => void;
  isVisible: boolean;
  walletKey?: Key;
}

const MultisigOptions = ({
  isVisible,
  setShowMultisigOptions,
  walletKey,
}: MultisigOptionsProps) => {
  const {t} = useTranslation();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const themeType = useThemeType();
  const optionList: Option[] = [
    {
      title: t('Create a Shared Wallet'),
      description: t('Use more than one device to create a multisig wallet'),
      onPress: () => {
        dispatch(
          Analytics.track('Clicked Create Multisig Wallet', {
            context: walletKey ? 'AddingOptions' : 'CreationOptions',
          }),
        );
        navigation.navigate('Wallet', {
          screen: 'CurrencySelection',
          params: {context: 'addWalletMultisig', key: walletKey},
        });
      },
      imgSrc: MultisigSharedOptionImage[themeType],
    },
    {
      title: t('Create a Shared Wallet(Read Only)'),
      description: t('Use more than one device to create a multisig wallet'),
      onPress: () => {
        dispatch(
          Analytics.track('Clicked Create Multisig Wallet', {
            context: walletKey ? 'AddingOptions' : 'CreationOptions',
          }),
        );
        navigation.navigate('Wallet', {
          screen: 'CurrencySelection',
          params: {context: 'addReadonlyWalletMultisig', key: walletKey},
        });
      },
      imgSrc: MultisigSharedOptionImage[themeType],
    },
    {
      title: t('Join a Shared Wallet'),
      description: t(
        "Joining another user's multisig wallet requires an invitation to join",
      ),
      onPress: () => {
        dispatch(
          Analytics.track('Clicked Join Multisig Wallet', {
            context: walletKey ? 'AddingOptions' : 'CreationOptions',
          }),
        );
        navigation.navigate('Wallet', {
          screen: 'JoinMultisig',
          params: {key: walletKey},
        });
      },
      imgSrc: MultisigJoinOptionImage[themeType],
    },
    {
      title: t('Join a Shared Wallet(Read Only)'),
      description: t(
        "Joining another user's multisig wallet requires an invitation to join",
      ),
      onPress: () => {
        dispatch(
          Analytics.track('Clicked Join Multisig Wallet', {
            context: walletKey ? 'AddingOptions' : 'CreationOptions',
          }),
        );
        navigation.navigate('Wallet', {
          screen: 'JoinReadonlyMultisig',
          params: {key: walletKey},
        });
      },
      imgSrc: MultisigJoinOptionImage[themeType],
    },
  ];

  return (
    <OptionsSheet
      isVisible={isVisible}
      title={'Multisig'}
      options={optionList}
      closeModal={() => setShowMultisigOptions(false)}
    />
  );
};

export default MultisigOptions;
