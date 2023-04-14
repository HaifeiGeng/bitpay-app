import React, {useEffect, useState} from 'react';
import QRCode from 'react-native-qrcode-svg';
import styled from 'styled-components/native';
import {Paragraph, H4} from '../../../components/styled/Text';
import SheetModal from '../../../components/modal/base/sheet/SheetModal';
import {
  SheetContainer,
} from '../../../components/styled/Containers';
import {Action, LightBlack, White} from '../../../styles/colors';
import DynamicQrCodeHeader from './DynamicQrCodeHeader';
import {useTranslation} from 'react-i18next';
import QRCodeComponent from './QRCodeComponent';

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
  const [coin, setCoin] = useState('');
  // console.log('---------- DynamicQrCode 方法内 展示动态二维码之前  : ', JSON.stringify(dynamicQrCodeData)) ;


  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [intervalHandler, setIntervalHandler] = useState<NodeJS.Timeout | undefined>();
  const [displayQRCode, setDisplayQRCode] = useState(true);
  const [fragments, setFragments] = useState<string[]>([]);

  const capacity = 200;

  useEffect(() => {
    try {
      setCoin(dynamicQrCodeData.txp.coin);
      // fragments.push(...encodeUR(value, capacity));
      const fragmentsEncoded = ['baaklsjhdfklashdfkljsahdfklhsakldfhslakhfdklas', 'hklhlkwehjrlthwelktwhklert', 'sdfkasjhdflkajhsdfkjashkldfhlkasjhfjklasdhfjklashkdlf', 'basmdnfasbdfabsdfmnasbkdfgasuhkdgfjkashbdfjkashgdfkdjf'];
      setFragments(fragmentsEncoded);
      setTotal(fragmentsEncoded.length);
      setDisplayQRCode(true);
    } catch (e) {
      console.log(e);
      setDisplayQRCode(false);
    }
    return () => {
      if(intervalHandler){
        console.log('---------- DynamicQrCode 组件已经卸载');
        clearInterval(intervalHandler);
      }
    }
  }, []);


  useEffect(() => {
    if(total > 0){
      startAutoMove();
    }
  }, [total, index]);

  const startAutoMove = () => {
    console.log('----------  准备执行 ：', index, total);
    if (!intervalHandler) {
      setIntervalHandler(setInterval(() => setIndex(prevState => {
        return (prevState + 1) % total
      }), 200));
    }
  };

  const getCurrentFragment = () => {
    const currentFragment = fragments[index];
    if (currentFragment) {
      return currentFragment.toUpperCase();
    }
  }



  const _closeModal = () => {
    closeModal();
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={_closeModal}>
      <ReceiveAddressContainer>
        <DynamicQrCodeHeader />
        {
          coin === 'btc' && displayQRCode ? (
          <QRCodeContainer>
            <QRCodeBackground>
              {/* <QRCode value={qrCodeData} size={200} /> */}
              <QRCodeComponent 
                value={getCurrentFragment()}
              />
            </QRCodeBackground>
          </QRCodeContainer>
          ) : (
            <H4>只有比特币钱包需要签名</H4>
          )
        }

        <CloseButton onPress={_closeModal}>
          <CloseButtonText>{t('CLOSE')}</CloseButtonText>
        </CloseButton>
      </ReceiveAddressContainer>
    </SheetModal>
  );
};

export default DynamicQrCode;