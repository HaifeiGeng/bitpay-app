import React, {useEffect, useState, } from 'react';
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
import {
  BitcoreLib as Bitcore
} from 'crypto-wallet-core';
import { sleep } from '../../../utils/helper-methods';
import { ethers } from 'ethers';
import { LogActions } from '../../../store/log';
import { CANAAN_ABI, GAS_LIMIT, getProvider } from '../../../constants/EthContract';


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
  dynamicEthQrCodeData: any;
  onShowPaymentSent: () => void;
  lastSigner?: boolean;
  showLoading: (flag: boolean) => void;
}
let decoder: BlueURDecoder | undefined;
const DynamicEthQrCode = ({isVisible, closeModal, dynamicEthQrCodeData, onShowPaymentSent, lastSigner = false, showLoading}: Props) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const [coin, setCoin] = useState('');
  
  

  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [displayQRCode, setDisplayQRCode] = useState(true);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(false);
  const [urTotal, setUrTotal] = useState<number>(0);
  const [urHaveCount, setUrHaveCount] = useState<number>(0);

  const [m, setM] = useState<number>(dynamicEthQrCodeData.txp.m | 0);
  const [n, setN] = useState<number>(dynamicEthQrCodeData.txp.n | 0);
  const [signerNum, setSignerNum] = useState<number>(1);

  const [r, setR] = useState<string[]>([]);
  const [s, setS] = useState<string[]>([]);
  const [v, setV] = useState<number[]>([]);

  const win = Dimensions.get('window');

  useEffect(() => {

    dispatch(LogActions.info('Starting [DynamicEthQrCode] ETH二维码'));
    const txp =  {
      ...dynamicEthQrCodeData.txp, 
      properties: '', 
      currencyAbbreviation: dynamicEthQrCodeData.wallet.currencyAbbreviation
    }
    const rootPath = dynamicEthQrCodeData.wallet.credentials.rootPath;

    console.log(`---------- DynamicEthQrCode 方法内 展示动态二维码之前  二维码内容 txp = [${JSON.stringify(txp)}]  rootPath = [${rootPath}] `) ;
    console.log(`---------- DynamicEthQrCode 方法内 展示动态二维码之前  多签信息 m = [${m}]  n = [${n}] `) ;

    const fragmentsEncoded = encodeUR(
      Buffer.from(JSON.stringify({txp,  rootPath}), 'ascii').toString('hex'),
      100,
    );

    console.log(`---------- DynamicEthQrCode 方法内 展示动态二维码之前  隐藏私钥 = [${JSON.stringify({...dynamicEthQrCodeData.txp, properties: ''})}] `) ;
    console.log(`---------- DynamicEthQrCode 方法内 展示动态二维码之前  dynamicEthQrCodeData = [${JSON.stringify(dynamicEthQrCodeData)}] `) ;
    console.log(`---------- DynamicEthQrCode 方法内 展示动态二维码之前  私钥 = [${dynamicEthQrCodeData.txp.properties}] derivationPath = [${dynamicEthQrCodeData.wallet.credentials.rootPath}]`) ;
    
    try {
      setCoin(dynamicEthQrCodeData.txp.coin);
      setFragments(fragmentsEncoded);
      setTotal(fragmentsEncoded.length);
    } catch (e) {
      console.log(e);
      setDisplayQRCode(false);
    }

    return () => {
      // 在组件卸载时执行清理操作
      console.log(`---------- DynamicEthQrCode useEffect 卸载 `);  
      // 执行其他清理操作，如取消订阅、清除计时器等
      dispatch(LogActions.info('Success [DynamicEthQrCode] ETH二维码 卸载'));
    };
  }, []);


  useEffect(() => {
    let intervalId: any;
    if(total > 0){
      if (displayQRCode) {
        intervalId = setInterval(() => {
          setIndex((prevIndex) => {
            // console.log(`---------- DynamicEthQrCode useEffect 调用定时器 intervalId = [${intervalId}] total = [${total}] index = [${prevIndex}]`);
            return (prevIndex + 1) % total;
          });
        }, 300);
      }
    }

    return () => {
      if(!!intervalId){
        console.log(`---------- DynamicEthQrCode useEffect 卸载 intervalId = [${intervalId}] total = [${total}] index = [${index}]`);
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


  const _closeModal = () => {
    closeModal();
  };


  const _nextStep = () => {
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

  const _validSignature = (destination: string, value: number, vs: number[], rs: string[], ss: string[], data: string, nonce: number, receiveAddress: string) => {
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: destination = [${destination}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: value = [${value}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: vs = [${JSON.stringify(vs)}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: rs = [${JSON.stringify(rs)}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: ss = [${JSON.stringify(ss)}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: data = [${data}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: nonce = [${nonce}]`);
    console.log(`----------  DynamicEthQrCode  验签参数 扫描到的数据: receiveAddress = [${receiveAddress}]`);




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
  // =========================== 签名相关方法 =======================================================================



  const onBarCodeScanned = ({data}: {data: string}) => {
    // console.log('----------  扫描到的数据1：', data);
    if (!decoder) {
      decoder = new BlueURDecoder();
    }
    try {
      decoder.receivePart(data);
      if (decoder.isComplete()) {
        
        const parseData = decoder.toString();
        const parseDataObj = JSON.parse(parseData);
        console.log(`----------  DynamicEthQrCode  扫描到的数据: [${parseData}]`);
        decoder = undefined; // nullify for future use (?)
        setOpenCamera(false);
        // 开始签名
        dispatch(LogActions.info(`Starting [DynamicEthQrCode] 读取签名 ETH二维码 第${signerNum}次`));
        console.log(`----------  DynamicEthQrCode  获取签名数据 目前的n = [${n}]`);
        const newN = n - 1;
        setN(newN);
        setSignerNum((preSignerNum) => {
          return preSignerNum + 1;
        });
        console.log(`----------  DynamicEthQrCode  获取签名数据 -1之后的n = [${newN}]`);


        //  const [r, setR] = useState<string[]>([]);
        //  const [s, setS] = useState<string[]>([]);
        //  const [v, setV] = useState<number[]>([]);
        const finalR = [...r, parseDataObj.r];
        const finalS = [...s, parseDataObj.s];
        const finalV = [...v, parseDataObj.v];

        console.log(`----------  DynamicEthQrCode  获取签名数据 finalR = [${JSON.stringify(finalR)}]`);
        console.log(`----------  DynamicEthQrCode  获取签名数据 finalS = [${JSON.stringify(finalS)}]`);
        console.log(`----------  DynamicEthQrCode  获取签名数据 finalV = [${JSON.stringify(finalV)}]`);


        setR(finalR);
        setS(finalS);
        setV(finalV);

        if(newN > 0){
          // 未完成，继续扫码
          console.log(`----------  DynamicEthQrCode  未完成 需要继续扫码 newN = [${newN}]`);
          dispatch(LogActions.info(`Starting [DynamicEthQrCode] 读取签名 ETH二维码 未完成, 需要继续扫码`));
          setDisplayQRCode(true);
        } else {
          
          console.log(`----------  DynamicEthQrCode  扫码完成了，开始执行转圈`);
          const doPay = async () => {
            closeModal();
            showLoading(true);
            await sleep(500);
            // dispatch(startOnGoingProcessModal('SIGNING'));
            
            // 签名完毕，满足签名需求，去签名，签名后广播，之后跳转到PaymentSent页面。
            // 获取该派生路径下的私钥
            console.log(`---------- DynamicEthQrCode 方法内 签名中  dynamicEthQrCodeData = [${JSON.stringify(dynamicEthQrCodeData)}]`) ;
            const xpriv = new Bitcore.HDPrivateKey(dynamicEthQrCodeData.txp.properties);
            const derived = xpriv.derive(dynamicEthQrCodeData.wallet.credentials.rootPath + '/0/0');
            const subPrivateKey = '0x' + derived.privateKey;
            console.log(`---------- DynamicEthQrCode 方法内 签名中  获取到的HDPrivateKey = [${JSON.stringify(xpriv)}] 子私钥 = [${subPrivateKey}]`) ;
  
            // USDT测试： 0x9DC9a9a2a753c13b63526d628B1Bf43CabB468Fe
            const destination = dynamicEthQrCodeData.txp.destination; // 0x9DC9a9a2a753c13b63526d628B1Bf43CabB468Fe
            const value = dynamicEthQrCodeData.txp.value;
            const signData = dynamicEthQrCodeData.txp.data;
            let addresses = _validSignature(destination, value, finalV, finalR, finalS, signData, dynamicEthQrCodeData.txp.nonce, dynamicEthQrCodeData.wallet.receiveAddress);
            console.log(`---------- DynamicEthQrCode 方法内 签名中  addresses = [${JSON.stringify(addresses)}]`) ;
            const provider = getProvider(dynamicEthQrCodeData.wallet.network,)
            const wallet = new ethers.Wallet(subPrivateKey, provider);
            console.log(`---------- DynamicEthQrCode 方法内 wallet创建完毕`) ;
            // 声明可写合约
            const contractWrite = new ethers.Contract(dynamicEthQrCodeData.wallet.receiveAddress, CANAAN_ABI, wallet);
            console.log(`---------- DynamicEthQrCode 方法内 写合约 创建完毕`) ;
            console.log(`---------- DynamicEthQrCode 签名参数: destination = [${JSON.stringify(destination)}] value = [${JSON.stringify(value)}] finalV = [${JSON.stringify(finalV)}] finalR = [${JSON.stringify(finalR)}] finalS = [${JSON.stringify(finalS)}] signData = [${JSON.stringify(signData)}]`) ;
            // 发起交易
            const tx2 = await contractWrite.spend(destination, value, finalV, finalR, finalS, signData, { gasLimit: GAS_LIMIT });
            console.log(`---------- DynamicEthQrCode 方法内 签名中  tx2 = [${JSON.stringify(tx2)}]`) ;
            dispatch(LogActions.info(`Starting [DynamicEthQrCode] 读取签名 ETH二维码 签名中....`));
            // 等待交易上链
            await tx2.wait();
            console.log(`---------- DynamicEthQrCode 方法内 签名中, 上链完毕  。。。`) ;
            dispatch(LogActions.info(`Starting [DynamicEthQrCode] 读取签名 ETH二维码 上链完毕`));
            // dispatch(dismissOnGoingProcessModal());
            console.log(`----------  DynamicEthQrCode  上链完毕，结束执行转圈`);
            showLoading(false);
            onShowPaymentSent();
          }
          doPay();
        }
      } else {
        setUrTotal(decoder.expectedPartCount());
        setUrHaveCount(decoder.receivedPartIndexes().length || 0);
      }
      dispatch(LogActions.info(`Success [DynamicEthQrCode] 读取签名 ETH二维码 完毕`));
    } catch (error: any) {
      console.error(`----------  支付出现异常了  error = ${JSON.stringify(error)}`);
      const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
      dispatch(LogActions.error(`Failed [DynamicEthQrCode] 读取签名 ETH二维码 出现异常了 : ${errorStr}`));
      showLoading(false);
      // 如果出现异常，需要展示错误信息
      showBottomNotificationModal({
        type: 'warning',
        title: t('Something went wrong'),
        message: error.message,
        enableBackdropDismiss: true,
        actions: [
          {
            text: t('OK'),
            action: () => {},
            primary: true,
          },
        ],
      })
    }
  };

  return (
    <SheetModal isVisible={isVisible} onBackdropPress={() => {}}>
      <ReceiveAddressContainer>
        <DynamicQrCodeHeader title={t('Waiting for signer') + signerNum}  />
        {coin === 'eth' && displayQRCode ? (
          <QRCodeContainer>
            <QRCodeBackground>
              <QRCodeComponent value={getCurrentFragment()} />
            </QRCodeBackground>
          </QRCodeContainer>
        ) : coin === 'eth' && !displayQRCode && openCamera ? (
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
          <H4>ETH</H4>
        )}

        <View style={{flexDirection: 'row', marginTop: 50}}>
          <CloseButton onPress={handleFinish}>
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

export default DynamicEthQrCode;

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
