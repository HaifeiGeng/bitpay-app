import React, {useLayoutEffect} from 'react';
import styled from 'styled-components/native';
import {HeaderTitle} from '../../../components/styled/Text';
import {useNavigation} from '@react-navigation/native';
import {WalletStackParamList} from '../WalletStack';
import {StackScreenProps} from '@react-navigation/stack';
import {useTranslation} from 'react-i18next';
import RecoveryColdWallet from '../components/RecoveryColdWallet';

type ImportColdWalletScreenProps = StackScreenProps<WalletStackParamList, 'ImportColdWallet'>;

export interface ImportColdWalletParamList {
  context?: string;
  keyId?: string;
  importQrCodeData?: string;
}

const ImportContainer = styled.SafeAreaView`
  flex: 1;
  margin-top: 10px;
`;

const ImportColdWallet: React.FC<ImportColdWalletScreenProps> = ({route}) => {
  const {t} = useTranslation();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HeaderTitle>{t('Import Cold Wallet')}</HeaderTitle>,
      headerTitleAlign: 'center',
    });
  }, [navigation, t]);

  return (
    <ImportContainer>
      <RecoveryColdWallet />
    </ImportContainer>
  );
};

export default ImportColdWallet;
