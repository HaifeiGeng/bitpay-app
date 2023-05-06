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
} from 'react-native';
import {RNCamera} from 'react-native-camera';
import { broadcastTx } from '../../../store/wallet/effects/send/send';
import {useAppDispatch} from '../../../utils/hooks';
import {Analytics} from '../../../store/analytics/analytics.effects';
import {
  startOnGoingProcessModal,
} from '../../../store/app/app.effects';
import {
  dismissOnGoingProcessModal,
} from '../../../store/app/app.actions';
import { showBottomNotificationModal } from '../../../store/app/app.actions';


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
  onShowPaymentSent: () => void;
  lastSigner?: boolean;
}
let decoder: BlueURDecoder | undefined;
const DynamicQrCode = ({isVisible, closeModal, dynamicQrCodeData, onShowPaymentSent, lastSigner = false}: Props) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const [coin, setCoin] = useState('');
  // console.log('---------- DynamicQrCode 方法内 展示动态二维码之前  : ', JSON.stringify(dynamicQrCodeData)) ;
  const fragmentsEncoded = encodeUR(
    Buffer.from(JSON.stringify({txp: dynamicQrCodeData.txp, rootPath: dynamicQrCodeData.wallet.credentials.rootPath}), 'ascii').toString('hex'),
    100,
  );

  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [intervalHandler, setIntervalHandler] = useState<NodeJS.Timeout | undefined>();
  const [displayQRCode, setDisplayQRCode] = useState(true);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(false);
  const [urTotal, setUrTotal] = useState<number>(0);
  const [urHaveCount, setUrHaveCount] = useState<number>(0);

  const win = Dimensions.get('window');

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
        // console.log('---------- DynamicQrCode 组件已经卸载');
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
          200,
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
      setIntervalHandler(undefined);
    }
    setDisplayQRCode(false);
    setOpenCamera(true);
  };


  const handleFinish = async () => {
    try {
      await dispatch(
        showBottomNotificationModal({
          type: 'question',
          title: t('Finish'),
          message: t('Are you sure?'),
          enableBackdropDismiss: true,
          actions: [
            {
              text: t('Ok'),
              action: () => {
                _closeModal();
              },
              primary: true,
            },
            {
              text: t('Nevermind'),
              action: () => {},
              primary: false,
            },
          ],
        }),
      );
    } catch (error) {
      console.error('关闭失败:', error);
    }
  }

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

        setOpenCamera(false);
        closeModal();
        dispatch(startOnGoingProcessModal('SENDING_PAYMENT'));
        const signatureArray = parseData.split(',');
        dynamicQrCodeData.wallet.pushSignatures(
          dynamicQrCodeData.txp,
          signatureArray,
          async (err: Error, signedTxp: any) => {
            if (err) {
              console.log('----------  签名返回值： 失败', JSON.stringify(err));
            }
            console.log('----------  签名返回值： 成功1', JSON.stringify(signedTxp));
            if(dynamicQrCodeData.wallet.n === 1 || lastSigner){
              // 如果是单签， 或者是最后一个人签名，需要进行广播
              let broadcastedTx = await broadcastTx(dynamicQrCodeData.wallet, signedTxp);
              console.log('----------  签名返回值： 成功2 broadcastedTx = ', JSON.stringify(broadcastedTx));
            }
            dispatch(
              Analytics.track('Sent Crypto', {
                context: 'Confirm',
                coin: dynamicQrCodeData.wallet.currencyAbbreviation || '',
              }),
            );
            dispatch(dismissOnGoingProcessModal());
            onShowPaymentSent();
          },
          null,
        );
      } else {
        setUrTotal(decoder.expectedPartCount());
        setUrHaveCount(decoder.receivedPartIndexes().length || 0);
        // setUrHave(parseFloat((decoder.getProgress() * 100).toFixed(2)));
      }
    } catch (error) {
      console.warn(error);
      dispatch(dismissOnGoingProcessModal());
    }
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={() => {}}>
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
            <Text  style={styles.title}>{urHaveCount} / {urTotal}</Text>
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
            <CloseButton onPress={handleFinish}>
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
