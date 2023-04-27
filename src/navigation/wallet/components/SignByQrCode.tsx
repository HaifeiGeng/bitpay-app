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

import {signTxForCold, signTx} from '../../../store/wallet/effects/send/send';
import { useAppSelector } from '../../../utils/hooks';
import { Key, Wallet } from '../../../store/wallet/wallet.models';

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
  const [intervalHandler, setIntervalHandler] = useState<
    NodeJS.Timeout | undefined
  >();
  const [displayQRCode, setDisplayQRCode] = useState(false);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(true);
  const [urTotal, setUrTotal] = useState(0);
  const [urHave, setUrHave] = useState(0);

  const capacity = 200;

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
      console.log('---------- SignByQrCode 组件已经卸载');
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
      80,
    );
    setFragments(fragmentsEncoded);
    setTotal(fragmentsEncoded.length);
  };

  const _closeModal = () => {
    closeModal();
    setTimeout(() => {
      setOpenCamera(true);
      setDisplayQRCode(false);
    }, 500);
    if (intervalHandler) {
      clearInterval(intervalHandler);
    }
  };

  const _nextStep = () => {
    if (intervalHandler) {
      clearInterval(intervalHandler);
    }
    setOpenCamera(false);
    setDisplayQRCode(true);
  };

  const win = Dimensions.get('window');

  const handleCopy = (dataString: string) => {
    Clipboard.setString(JSON.stringify(dataString));
    ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
  };

  const onBarCodeScanned = async ({data}: {data: string}) => {
    if (!decoder) {
      decoder = new BlueURDecoder();
    }
    try {
      decoder.receivePart(data);
      if (decoder.isComplete()) {
        const parseData = decoder.toString();
        console.log('----------  扫描到的数据：', parseData);
        decoder = undefined;
        _nextStep();
        // Alert.alert('扫描完毕', JSON.stringify(parseData), [{text: 'Cancel'}], {
        //   cancelable: true,
        // });
        console.log("---------------- wallet" + JSON.stringify(fullWalletObj));
        console.log("---------------- key" + JSON.stringify(keyObj));

        const {txp, rootPath} = JSON.parse(parseData);

        // const key = useAppSelector(({WALLET}) => WALLET.keys[keyId]) as Key;
        // const wallet = findWalletById(key.wallets, walletId) as Wallet;
        console.log('----------  扫描到的数据：解构出来的数据', JSON.stringify(txp), JSON.stringify(rootPath));
        const signature = await signTxForCold(rootPath, keyObj, txp);
        
        console.log('----------  扫描到的签名：', JSON.stringify(signature));
        handleCopy(signature.join(','));
        // 扫描完毕，已经获取所有的扫描结果，将扫描结果作为二维码的展示数据
        buildQrData(signature.join(','));
        // onBarScanned({ data });
      } else {
        setUrTotal(100);
        setUrHave(Math.floor(decoder.estimatedPercentComplete() * 100));
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
            <Text style={styles.title}>
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
          {/* {!displayQRCode ? (
            <CloseButton onPress={_nextStep}>
              <CloseButtonText>{t('Next step')}</CloseButtonText>
            </CloseButton>
          ) : null} */}
          {displayQRCode && (
            <CloseButton onPress={_closeModal}>
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
