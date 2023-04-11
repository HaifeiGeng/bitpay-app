import React, {useEffect, useState} from 'react';
import QRCode from 'react-native-qrcode-svg';
import styled from 'styled-components/native';
import {Paragraph} from '../../../components/styled/Text';
import SheetModal from '../../../components/modal/base/sheet/SheetModal';
import {
  SheetContainer,
} from '../../../components/styled/Containers';
import {Action, LightBlack, White} from '../../../styles/colors';
import DynamicQrCodeHeader from './DynamicQrCodeHeader';
import {useTranslation} from 'react-i18next';

export const BchAddressTypes = ['Cash Address', 'Legacy'];

const QRCodeContainer = styled.View`
  align-items: center;
  margin: 15px;
`;

const QRCodeBackground = styled.View`
  background-color: ${White};
  width: 225px;
  height: 225px;
  justify-content: center;
  align-items: center;
  border-radius: 12px;
`;

const ReceiveAddressContainer = styled(SheetContainer)`
  background-color: ${({theme: {dark}}) => (dark ? LightBlack : White)};
  min-height: 500px;
`;

const CloseButton = styled.TouchableOpacity`
  margin: auto;
`;

const CloseButtonText = styled(Paragraph)`
  color: ${({theme: {dark}}) => (dark ? White : Action)};
`;

interface Props {
  isVisible: boolean;
  closeModal: () => void;
  dynamicQrCodeData: any;
}

const DynamicQrCode = ({isVisible, closeModal, dynamicQrCodeData}: Props) => {
  const {t} = useTranslation();
  const [qrCodeData, setQrCodeData] = useState('');
  console.log('---------- DynamicQrCode 方法内 展示动态二维码之前  : ', JSON.stringify(dynamicQrCodeData)) 

  useEffect(() => {
    setQrCodeData('测试二维码， 内容balabala。。。');
  }, []);

  const _closeModal = () => {
    closeModal();
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={_closeModal}>
      <ReceiveAddressContainer>
      <DynamicQrCodeHeader />

        <QRCodeContainer>
          <QRCodeBackground>
            <QRCode value={qrCodeData} size={200} />
          </QRCodeBackground>
        </QRCodeContainer>

        <CloseButton onPress={_closeModal}>
          <CloseButtonText>{t('CLOSE')}</CloseButtonText>
        </CloseButton>
      </ReceiveAddressContainer>
    </SheetModal>
  );
};

export default DynamicQrCode;
