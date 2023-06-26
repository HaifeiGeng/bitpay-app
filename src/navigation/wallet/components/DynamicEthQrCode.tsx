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
import { ethers } from 'ethers'
import { ETHERSCAN_API_KEY } from '../screens/KeyOverview';


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
}
let decoder: BlueURDecoder | undefined;
const DynamicEthQrCode = ({isVisible, closeModal, dynamicEthQrCodeData, onShowPaymentSent, lastSigner = false}: Props) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const [coin, setCoin] = useState('');
  
  

  // 动态二维码
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [intervalHandler, setIntervalHandler] = useState<NodeJS.Timeout | undefined>();
  const [displayQRCode, setDisplayQRCode] = useState(true);
  const [fragments, setFragments] = useState<string[]>([]);
  const [openCamera, setOpenCamera] = useState(false);
  const [urTotal, setUrTotal] = useState<number>(0);
  const [urHaveCount, setUrHaveCount] = useState<number>(0);

  const [m, setM] = useState<number>(dynamicEthQrCodeData.txp.m | 0);
  const [n, setN] = useState<number>(dynamicEthQrCodeData.txp.n | 0);

  const [r, setR] = useState<string[]>([]);
  const [s, setS] = useState<string[]>([]);
  const [v, setV] = useState<number[]>([]);

  const win = Dimensions.get('window');

  useEffect(() => {

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



  const onBarCodeScanned = async ({data}: {data: string}) => {
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
        // 开始签名 TODO...

        console.log(`----------  DynamicEthQrCode  获取签名数据 目前的n = [${n}]`);
        const newN = n - 1;
        setN(newN);
        await sleep(500);
        console.log(`----------  DynamicEthQrCode  获取签名数据 -1之后的n = [${newN}]`);


        //  const [r, setR] = useState<string[]>([]);
        //  const [s, setS] = useState<string[]>([]);
        //  const [v, setV] = useState<number[]>([]);
        const finalR = [...r, parseDataObj.r];
        const finalS = [...s, parseDataObj.s]
        const finalV = [...v, parseDataObj.v]

        console.log(`----------  DynamicEthQrCode  获取签名数据 finalR = [${JSON.stringify(finalR)}]`);
        console.log(`----------  DynamicEthQrCode  获取签名数据 finalS = [${JSON.stringify(finalS)}]`);
        console.log(`----------  DynamicEthQrCode  获取签名数据 finalV = [${JSON.stringify(finalV)}]`);


        setR(finalR);
        setS(finalS);
        setV(finalV);

        if(newN > 0){
          // 未完成，继续扫码
          setDisplayQRCode(true);
          startAutoMove();
        } else {
          closeModal();
          await startOnGoingProcessModal('SENDING_PAYMENT');
          await sleep(500);
          // 签名完毕，满足签名需求，去签名，签名后广播，之后跳转到PaymentSent页面。
          // 获取该派生路径下的私钥
          const xpriv = new Bitcore.HDPrivateKey(dynamicEthQrCodeData.txp.properties);
          const derived = xpriv.derive(dynamicEthQrCodeData.wallet.credentials.rootPath + '/0/0');
          const subPrivateKey = '0x' + derived.privateKey;
          console.log(`---------- DynamicEthQrCode 方法内 签名中  获取到的HDPrivateKey = [${JSON.stringify(xpriv)}] 子私钥 = [${subPrivateKey}]`) ;

          // USDT测试： 0x9DC9a9a2a753c13b63526d628B1Bf43CabB468Fe
          const destination = dynamicEthQrCodeData.txp.destination; // 0x9DC9a9a2a753c13b63526d628B1Bf43CabB468Fe
          const value = 0;
          const signData = dynamicEthQrCodeData.txp.data;
          let addresses = _validSignature(destination, 0, finalV, finalR, finalS, signData, dynamicEthQrCodeData.txp.nonce, dynamicEthQrCodeData.wallet.receiveAddress);
          console.log(`---------- DynamicEthQrCode 方法内 签名中  addresses = [${JSON.stringify(addresses)}]`) ;
          const customeAbi = `[{"inputs":[{"internalType":"address[]","name":"_owners","type":"address[]"},{"internalType":"uint256","name":"_required","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Funded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Spent","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"MAX_OWNER_COUNT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOwners","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRequired","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getSpendNonce","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_operator","type":"address"},{"internalType":"address","name":"_from","type":"address"},{"internalType":"uint256","name":"_id","type":"uint256"},{"internalType":"uint256","name":"_value","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"onERC1155Received","outputs":[{"internalType":"bytes4","name":"","type":"bytes4"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_operator","type":"address"},{"internalType":"address","name":"_from","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"onERC721Received","outputs":[{"internalType":"bytes4","name":"","type":"bytes4"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"destination","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint8[]","name":"vs","type":"uint8[]"},{"internalType":"bytes32[]","name":"rs","type":"bytes32[]"},{"internalType":"bytes32[]","name":"ss","type":"bytes32[]"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"spend","outputs":[],"stateMutability":"nonpayable","type":"function"}]`;
          // const provider = new ethers.providers.EtherscanProvider(dynamicEthQrCodeData.wallet.network === 'livenet' ? 'homestead' : dynamicEthQrCodeData.wallet.network, ETHERSCAN_API_KEY);
          const provider = new ethers.providers.EtherscanProvider('goerli', ETHERSCAN_API_KEY);// TODO  测试完毕后删除
          const wallet = new ethers.Wallet(subPrivateKey, provider);
          console.log(`---------- DynamicEthQrCode 方法内 wallet创建完毕`) ;
          // 声明可写合约
          const contractWETH = new ethers.Contract(dynamicEthQrCodeData.wallet.receiveAddress, customeAbi, wallet);
          console.log(`---------- DynamicEthQrCode 方法内 写合约 创建完毕`) ;
          // const contractWETH = new ethers.Contract('0x9d71037b73b6A23F40A1241e4A34a2054258B9bb', customeAbi, wallet);
          // 发起交易
          const tx2 = await contractWETH.spend(destination, value, finalV, finalR, finalS, signData, { gasLimit: 150000 });
          console.log(`---------- DynamicEthQrCode 方法内 签名中  tx2 = [${JSON.stringify(tx2)}]`) ;
          // 等待交易上链
          await tx2.wait();
          console.log(`---------- DynamicEthQrCode 方法内 签名中, 上链完毕  。。。`) ;
          dispatch(
            Analytics.track('Sent Crypto', {
              context: 'Confirm',
              coin: dynamicEthQrCodeData.wallet.currencyAbbreviation || '',
            }),
          );
          await dismissOnGoingProcessModal();
          onShowPaymentSent();
        }











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
        {coin === 'eth' && displayQRCode ? (
          <QRCodeContainer>
            <QRCodeBackground>
              {/* <QRCode value={qrCodeData} size={200} /> */}
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
