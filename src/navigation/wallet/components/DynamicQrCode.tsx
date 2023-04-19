import React, {useEffect, useState} from 'react';
import styled from 'styled-components/native';
import {Paragraph, H4} from '../../../components/styled/Text';
import SheetModal from '../../../components/modal/base/sheet/SheetModal';
import {SheetContainer} from '../../../components/styled/Containers';
import {Action, LightBlack, White} from '../../../styles/colors';
import DynamicQrCodeHeader from './DynamicQrCodeHeader';
import {useTranslation} from 'react-i18next';
import QRCodeComponent from './QRCodeComponent';
import {encodeUR, BlueURDecoder} from '../../../utils/qr/ur';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  Alert,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import {RNCamera} from 'react-native-camera';

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
let decoder: BlueURDecoder | undefined;
const DynamicQrCode = ({isVisible, closeModal, dynamicQrCodeData}: Props) => {
  const {t} = useTranslation();
  const [coin, setCoin] = useState('');
  // console.log('---------- DynamicQrCode 方法内 展示动态二维码之前  : ', JSON.stringify(dynamicQrCodeData)) ;
  const fragmentsEncoded = encodeUR(
    Buffer.from(JSON.stringify(dynamicQrCodeData.txp), 'ascii').toString('hex'),
    80,
  );

  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [intervalHandler, setIntervalHandler] = useState<
    NodeJS.Timeout | undefined
  >();
  const [displayQRCode, setDisplayQRCode] = useState(true);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(false);
  const [urTotal, setUrTotal] = useState(0);
  const [urHave, setUrHave] = useState(0);

  const capacity = 200;

  useEffect(() => {
    try {
      setCoin(dynamicQrCodeData.txp.coin);
      setFragments(fragmentsEncoded);
      setTotal(fragmentsEncoded.length);
      setDisplayQRCode(true);
    } catch (e) {
      console.log(e);
      setDisplayQRCode(false);
    }
    return () => {
      if (intervalHandler) {
        console.log('---------- DynamicQrCode 组件已经卸载');
        clearInterval(intervalHandler);
      }
    };
  }, []);

  useEffect(() => {
    if (total > 0) {
      startAutoMove();
    }
  }, [total, index]);

  const startAutoMove = () => {
    // console.log('----------  当前index :', index, '当前 total :',total);
    if (!intervalHandler) {
      setIntervalHandler(
        setInterval(
          () =>
            setIndex(prevState => {
              return (prevState + 1) % total;
            }),
          300,
        ),
      );
    }
  };

  const getCurrentFragment = () => {
    const currentFragment = fragments[index];
    if (currentFragment) {
      return currentFragment.toUpperCase();
    } else {
      return '';
    }
  };

  const _closeModal = () => {
    closeModal();
  };

  const _nextStep = () => {
    if (intervalHandler) {
      clearInterval(intervalHandler);
    }
    setDisplayQRCode(false);
    setOpenCamera(true);
  };

  const win = Dimensions.get('window');

  const handleCopy = (dataString: string) => {
    Clipboard.setString(JSON.stringify(dataString));
    ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
  };

  const onBarCodeScanned = ({data}: {data: string}) => {
    // console.log('----------  扫描到的数据1：', data);
    if (!decoder) {
      decoder = new BlueURDecoder();
    }
    try {
      decoder.receivePart(data);
      if (decoder.isComplete()) {
        const parseData = decoder.toString();
        console.log('----------  扫描到的数据：', parseData);
        decoder = undefined; // nullify for future use (?)

        Alert.alert('扫描完毕', JSON.stringify(parseData), [{text: 'Cancel'}], {
          cancelable: true,
        });
        handleCopy(parseData);
        // onBarScanned({ data });
      } else {
        setUrTotal(100);
        setUrHave(Math.floor(decoder.estimatedPercentComplete() * 100));
        // console.log('----------  扫描到的数据 没完成 ：', urHave);
      }
    } catch (error) {
      console.warn(error);
      // setIsLoading(true);
      // Alert.alert(loc.send.scan_error, loc._.invalid_animated_qr_code_fragment, [
      //   {
      //     text: loc._.ok,
      //     onPress: () => {
      //       setIsLoading(false);
      //     },
      //     style: 'default',
      //   },
      //   { cancelabe: false },
      // ]);
    }
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={_closeModal}>
      <ReceiveAddressContainer>
        <DynamicQrCodeHeader title={t('Please sign')} />
        {coin === 'btc' && displayQRCode ? (
          <QRCodeContainer>
            <QRCodeBackground>
              {/* <QRCode value={qrCodeData} size={200} /> */}
              <QRCodeComponent value={getCurrentFragment()} />
            </QRCodeBackground>
          </QRCodeContainer>
        ) : coin === 'btc' && !displayQRCode && openCamera ? (
          <View style={styles.cameraContainer}>
            <Text style={styles.title}>
              {/* {t('Scan the QRCode loop')} ({(progress * 100).toFixed(0)}%) */}
              {t('Scan the QRCode loop')} ({urHave}%)
            </Text>
            <RNCamera
              style={styles.root}
              type={RNCamera.Constants.Type.back}
              onBarCodeRead={onBarCodeScanned}>
              <View style={styles.cameraContainer}>
                <View
                  style={[
                    styles.rect,
                    {width: win.width - 100, height: win.width - 100},
                  ]}
                />
              </View>
            </RNCamera>
          </View>
        ) : (
          <H4>只有比特币钱包需要签名</H4>
        )}

        <View style={{flexDirection: 'row', marginTop: 50}}>
          <CloseButton onPress={_closeModal}>
            <CloseButtonText>{t('CLOSE')}</CloseButtonText>
          </CloseButton>
          {displayQRCode ? (
            <CloseButton onPress={_nextStep}>
              <CloseButtonText>{t('Next step')}</CloseButtonText>
            </CloseButton>
          ) : null}
          {!displayQRCode && (
            <CloseButton onPress={_closeModal}>
              <CloseButtonText>{t('Finish')}</CloseButtonText>
            </CloseButton>
          )}
        </View>
      </ReceiveAddressContainer>
    </SheetModal>
  );
};

export default DynamicQrCode;

const styles = StyleSheet.create({
  root: {
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rect: {
    borderColor: 'white',
    borderWidth: 4,
  },
  title: {
    color: 'black',
    fontSize: 20,
    margin: 20,
  },
  scanProgress: {
    color: 'white',
    fontSize: 20,
    marginTop: 20,
  },
});
