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

import {
  BitcoreLib as Bitcore
} from 'crypto-wallet-core';
import { ethers } from 'ethers'
import { LogActions } from '../../../store/log';

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
const SignEthByQrCode = ({isVisible, closeModal, fullWalletObj, keyObj}: Props) => {

  const {t} = useTranslation();
  const [coin, setCoin] = useState('');
  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [displayQRCode, setDisplayQRCode] = useState(false);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(true);
  const [urTotal, setUrTotal] = useState<number>(0);
  const [urHaveCount, setUrHaveCount] = useState<number>(0);
  const [signing, setSigning] = useState<boolean>(false);
  const dispatch = useDispatch();

  const win = Dimensions.get('window');

  useEffect(() => {
    if(fullWalletObj.chain !== 'eth'){
      return;
    }
    dispatch(LogActions.info(`Starting [SignEthByQrCode] 扫描将要签名的数据`));
    console.log(`----------  SignEthByQrCode页面中,  fullWalletObj = [${JSON.stringify(fullWalletObj)}]`);
    console.log(`----------  SignEthByQrCode页面中,  keyObj = [${JSON.stringify(keyObj)}]`);
    try {
      setCoin(fullWalletObj.credentials.coin);
    } catch (e) {
      console.log(e);
      setDisplayQRCode(true);
    }
    return () => {
      setOpenCamera(false);
      dispatch(LogActions.info(`Success [SignEthByQrCode] 扫描将要签名的数据`));
    };
  }, []);

  useEffect(() => {
    let intervalId: any;
    if(total > 0){
      if (displayQRCode) {
        intervalId = setInterval(() => {
          setIndex((prevIndex) => {
            // console.log(`---------- SignEthByQrCode useEffect 调用定时器 intervalId = [${intervalId}] total = [${total}] index = [${prevIndex}]`);
            return (prevIndex + 1) % total;
          });
        }, 200);
      }
    }

    return () => {
      if(!!intervalId){
        console.log(`---------- SignEthByQrCode useEffect 卸载 intervalId = [${intervalId}] total = [${total}] index = [${index}]`);
        clearInterval(intervalId);
      }
    };
  }, [displayQRCode, total]);

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
    }, 100);
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


  // =========================== 签名相关方法 =======================================================================
  
  const generateMessageToSign = (destination: string, value: number, data: string, nonce: number, receiveAddress: string) => {
    let encode = ethers.utils.solidityPack(["address", "address", "uint256", "bytes", "uint256"], [receiveAddress, destination, value, data, nonce]);
    const message = ethers.utils.keccak256(encode);
    return message;
  }


  const _messageToRecover = (destination: string, value: number, data: string, nonce: number, receiveAddress: string) => {
    const hashedUnsignedMessage = generateMessageToSign(destination, value, data, nonce, receiveAddress);
    const prefix = ethers.utils.toUtf8Bytes("\x19Ethereum Signed Message:\n32");
    const messageToSign = ethers.utils.concat([prefix, hashedUnsignedMessage]);
    return ethers.utils.keccak256(messageToSign);
  }


  const _validSignature = (destination: string, value: number, data: string, nonce: number, vs: any[], rs: any[], ss: any[], receiveAddress: string) => {
    const message = _messageToRecover(destination, value, data, nonce, receiveAddress);
    const addresses = [];
    for (let i = 0; i < vs.length; i++) {
        const publicKey = ethers.utils.recoverPublicKey(
            message,
            ethers.utils.concat([
                ethers.utils.hexlify(rs[i]),
                ethers.utils.hexlify(ss[i]),
                ethers.utils.hexlify(vs[i])
            ])
        );
        const address = ethers.utils.computeAddress(publicKey);
        addresses.push(address);
    }
    return addresses;
  }


  const sign = async (destination: string, value: number, data: string, nonce: number, privateKey: string, receiveAddress: string) => {
    console.log(`----------   SignEthByQrCode页面中,  签名方法  参数 destination = [${destination}], value = [${value}], data = [${data}], nonce = [${nonce}], privateKey = [${privateKey}], receiveAddress = [${receiveAddress}]`);
    const message = _messageToRecover(destination, value, data, nonce, receiveAddress);
    const signingKey = new ethers.utils.SigningKey(privateKey);
    const signature = signingKey.signDigest(message);
    
    return signature;
  }






  // =========================== 签名相关方法 =======================================================================

  const onBarCodeScanned = async ({data}: {data: string}) => {
    if (!decoder) {
      decoder = new BlueURDecoder();
    }
    try {
      decoder.receivePart(data);
      if (decoder.isComplete()) {
        const parseData = decoder.toString();
        console.log('----------   SignEthByQrCode页面中,  扫描到的数据：', parseData);
        decoder = undefined; // nullify for future use (?)
        setOpenCamera(false);
        setSigning(true);

        dispatch(LogActions.info(`Starting [SignEthByQrCode] 扫描将要签名的数据 扫描完毕, 获得将要签名的数据`));
        const {txp: {
          data, 
          value, 
          destination, // 测试时使用的是测试网的USDT
          nonce, 
          coin, 
          receiveAddress, 
          currencyAbbreviation,
        }, 
        rootPath } = JSON.parse(parseData);

        // 获取该派生路径下的私钥
        const xpriv = new Bitcore.HDPrivateKey(keyObj.properties.xPrivKey);
        const derivedPrivateKey = xpriv.derive(fullWalletObj.credentials.rootPath + '/0/0');
        console.log(`----------  SignEthByQrCode页面中,  rootPath = [${JSON.stringify(fullWalletObj.credentials.rootPath)}]`);
        console.log(`----------  SignEthByQrCode页面中,  privateKey = [${JSON.stringify(keyObj.properties.xPrivKey)}]`);


        const signature = await sign(destination, value, data, nonce, '0x' + derivedPrivateKey.privateKey, receiveAddress);
        console.log(`----------   SignEthByQrCode页面中,  返回值 signature = [${JSON.stringify(signature)}]`);
        const finalResult = {
          r: signature.r,
          s: signature.s,
          v: signature.v - 27
        }
        console.log(`----------   SignEthByQrCode页面中,  返回值 finalResult = [${JSON.stringify(finalResult)}]`);

        // 扫描完毕，已经获取所有的扫描结果，将扫描结果作为二维码的展示数据
        buildQrData(JSON.stringify(finalResult));
        await sleep(500);
        setSigning(false);
        setDisplayQRCode(true);
        dispatch(LogActions.info(`Success [SignEthByQrCode] 扫描将要签名的数据 扫描完毕, 获得将要签名的数据`));
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
      const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
      dispatch(LogActions.error(`Failed [SignEthByQrCode] 扫描将要签名的数据 出错了 : ${errorStr}`));
    }
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={() => {}}>
      <ReceiveAddressContainer>
        <DynamicQrCodeHeader title={t('Please sign')} />
        {coin === 'eth' && displayQRCode ? (
          <QRCodeContainer>
            <QRCodeBackground>
              {/* <QRCode value={qrCodeData} size={200} /> */}
              <QRCodeComponent value={getCurrentFragment()} />
            </QRCodeBackground>
          </QRCodeContainer>
        ) : coin === 'eth' && !displayQRCode && openCamera ? (
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

export default SignEthByQrCode;

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
