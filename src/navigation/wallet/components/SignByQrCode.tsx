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

import {signTxForCold} from '../../../store/wallet/effects/send/send';
import { sleep } from '../../../utils/helper-methods';
import {useDispatch,} from 'react-redux';
import { showBottomNotificationModal } from '../../../store/app/app.actions';

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
  fullWalletObj: any;
  keyObj: any;
}
let decoder: BlueURDecoder | undefined;
const SignByQrCode = ({isVisible, closeModal, fullWalletObj, keyObj}: Props) => {

  const {t} = useTranslation();
  const [coin, setCoin] = useState('');
  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [intervalHandler, setIntervalHandler] = useState<NodeJS.Timeout | undefined>();
  const [displayQRCode, setDisplayQRCode] = useState(false);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(true);
  const [urTotal, setUrTotal] = useState<number>(0);
  const [urHaveCount, setUrHaveCount] = useState<number>(0);
  const [signing, setSigning] = useState<boolean>(false);
  const dispatch = useDispatch();

  const win = Dimensions.get('window');

  useEffect(() => {
    try {
      setCoin(fullWalletObj.credentials.coin);
      setDisplayQRCode(false);
      setOpenCamera(true);
    } catch (e) {
      console.log(e);
      setDisplayQRCode(true);
    }
    return () => {
      setOpenCamera(false);
      if (intervalHandler) {
        clearInterval(intervalHandler);
      }
      // console.log('---------- SignByQrCode 组件已经卸载');
    };
  }, []);

  useEffect(() => {
    if (total > 0) {
      startAutoMove();
    }
  }, [total, index]);

  const startAutoMove = () => {
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

  const buildQrData = (data: string) => {
    const fragmentsEncoded = encodeUR(
      Buffer.from(data, 'ascii').toString('hex'),
      100,
    );
    setTotal(fragmentsEncoded.length);
    setFragments(fragmentsEncoded);
  };

  const _closeModal = () => {
    closeModal();
    setTimeout(() => {
      setOpenCamera(true);
      setDisplayQRCode(false);
    }, 500);
    if (intervalHandler) {
      clearInterval(intervalHandler);
      setIntervalHandler(undefined);
    }
    setFragments([]);
    setTotal(0);
    setUrHaveCount(0);
    setUrTotal(0);
  };

  const handleFinish = async () => {
    try {
      await dispatch(
        showBottomNotificationModal({
          type: 'question',
          title: t('finish?'),
          message: t('Are you sure finish?'),
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

  const onBarCodeScanned = async ({data}: {data: string}) => {
    if (!decoder) {
      decoder = new BlueURDecoder();
    }
    try {
      decoder.receivePart(data);
      if (decoder.isComplete()) {
        const parseData = decoder.toString();
        console.log('----------  扫描到的数据：', parseData);
        decoder = undefined; // nullify for future use (?)
        if (intervalHandler) {
          clearInterval(intervalHandler);
        }
        setOpenCamera(false);
        setSigning(true);
        const {txp, rootPath} = JSON.parse(parseData);
        const signature = await signTxForCold(rootPath, keyObj, txp);
        // 扫描完毕，已经获取所有的扫描结果，将扫描结果作为二维码的展示数据
        buildQrData(signature.join(','));
        await sleep(500);
        setSigning(false);
        setDisplayQRCode(true);
      } else {
        setUrTotal(decoder.expectedPartCount());
        setUrHaveCount(decoder.receivedPartIndexes().length || 0);
        // setUrHave(parseFloat((decoder.getProgress() * 100).toFixed(2)));
        // console.log('----------  扫描的数量', decoder.getProgress());
        // console.log(`----------  解码相关数量打印：expectedPartCount = ${decoder.expectedPartCount()} expectedPartIndexes = ${decoder.expectedPartIndexes()} receivedPartIndexes = ${decoder.receivedPartIndexes()} lastPartIndexes = ${decoder.lastPartIndexes()} estimatedPercentComplete = ${decoder.estimatedPercentComplete()} getProgress = ${decoder.getProgress()}`);
        // console.log(`----------  解码详细数量打印： 需要${decoder.expectedPartCount()}张二维码, 目前已经收到了${decoder.receivedPartIndexes().length || 0}张二维码 `);
      }
    } catch (error) {
      console.warn(error);
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
            <Text style={styles.title}>{urHaveCount} / {urTotal}</Text>
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
        ) : signing ? (
          <H4 style={{textAlign: 'center', }}>{t('Signing...')}</H4>
        ) : (
          <H4></H4>
        )}
        
        <View style={{flexDirection: 'row', marginTop: 50}}>
          <CloseButton onPress={_closeModal}>
            <CloseButtonText>{t('CLOSE')}</CloseButtonText>
          </CloseButton>
          {/* {!displayQRCode ? (
            <CloseButton onPress={_nextStep}>
              <CloseButtonText>{t('Next step')}</CloseButtonText>
            </CloseButton>
          ) : null} */}
          {displayQRCode && (
            <CloseButton onPress={handleFinish}>
              <CloseButtonText>{t('Finish')}</CloseButtonText>
            </CloseButton>
          )}
        </View>
      </ReceiveAddressContainer>
    </SheetModal>
  );
};

export default SignByQrCode;

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
