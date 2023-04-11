import React from 'react';
import haptic from '../../../components/haptic-feedback/haptic';
import RefreshIcon from '../../../components/icons/refresh/RefreshIcon';
import styled from 'styled-components/native';
import {BaseText, H4} from '../../../components/styled/Text';
import {Action, NeutralSlate, SlateDark} from '../../../styles/colors';
import {useTranslation} from 'react-i18next';

const Header = styled.View`
  margin-bottom: 30px;
  flex-direction: row;
  justify-content: center;
  position: relative;
  align-items: center;
`;

const Title = styled(H4)`
  color: ${({theme}) => theme.colors.text};
`;




const DynamicQrCodeHeader = () => {
  const {t} = useTranslation();
    return (
      <Header>
        <Title>{t('Please sign')}</Title>
      </Header>
    );
  }


export default DynamicQrCodeHeader;
