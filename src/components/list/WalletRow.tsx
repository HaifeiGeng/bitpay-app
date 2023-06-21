import React, {memo, ReactElement, useEffect, useState} from 'react';
import {
  Column,
  CurrencyImageContainer,
  CurrencyColumn,
  Row,
  ActiveOpacity,
  RowContainer,
} from '../styled/Containers';
import {Badge, H5, ListItemSubText} from '../styled/Text';
import styled from 'styled-components/native';
import {CurrencyImage} from '../currency-image/CurrencyImage';
import {Network} from '../../constants';
import {TransactionProposal} from '../../store/wallet/wallet.models';
import {CoinbaseAccountProps} from '../../api/coinbase/coinbase.types';
import NestedArrowIcon from '../nested-arrow/NestedArrow';
import {getProtocolName} from '../../utils/helper-methods';
import {Platform} from 'react-native';

import { ethers } from "ethers";
import { Wallet } from '../../store/wallet/wallet.models';

const BadgeContainer = styled.View`
  margin-left: 3px;
  margin-bottom: -2px;
`;

const BalanceColumn = styled(Column)`
  align-items: flex-end;
`;

const NestedArrowContainer = styled.View`
  align-items: center;
  justify-content: center;
  margin-right: 15px;
`;

export interface WalletRowProps {
  id: string;
  img: string | ((props: any) => ReactElement);
  badgeImg?: string | ((props?: any) => ReactElement);
  currencyName: string;
  currencyAbbreviation: string;
  chain: string;
  walletName?: string;
  cryptoBalance: string;
  cryptoLockedBalance?: string;
  cryptoConfirmedLockedBalance?: string;
  cryptoSpendableBalance?: string;
  cryptoPendingBalance?: string;
  fiatBalance: string;
  fiatLockedBalance?: string;
  fiatConfirmedLockedBalance?: string;
  fiatSpendableBalance?: string;
  fiatPendingBalance?: string;
  isToken?: boolean;
  network: Network;
  isRefreshing?: boolean;
  hideWallet?: boolean;
  hideBalance?: boolean;
  pendingTxps: TransactionProposal[];
  coinbaseAccount?: CoinbaseAccountProps;
  multisig?: string;
  currentWallet: Wallet;
}

interface Props {
  id: string;
  wallet: WalletRowProps;
  hideIcon?: boolean;
  isLast?: boolean;
  onPress: () => void;
  updateBalance: (walletId: string, sat: number) => void;
  contract?: any;
}

export const buildTestBadge = (
  network: string,
  chain: string,
  isToken: boolean | undefined,
): ReactElement | undefined => {
  if (isToken || ['livenet', 'mainnet'].includes(network)) {
    return;
  }
  // logic for mapping test networks to chain
  const badgeLabel = getProtocolName(chain, network);

  return (
    <BadgeContainer>
      <Badge>{badgeLabel}</Badge>
    </BadgeContainer>
  );
};

export const decimalsMap: { [key: string]: number } = {
  ETH: 18, // ETH小数位为18
  USDT: 6, // USDT小数位为6
  USDC: 6, // USDC小数位为6
  // 可以根据需要添加其他代币的小数位
};

const WalletRow = ({wallet, hideIcon, onPress, isLast, updateBalance, contract}: Props) => {
  const {
    currencyName,
    currencyAbbreviation, // 上游转换成了大写
    chain,
    walletName,
    img,
    badgeImg,
    cryptoBalance,
    fiatBalance,
    isToken,
    network,
    hideBalance,
    multisig,
    currentWallet,
  } = wallet;

  const [finalCryptoBalance, setFinalCryptoBalance] = useState<string>(cryptoBalance);
  const [finalFiatBalance, setFinalFiatBalance] = useState<string>(fiatBalance);
  // @ts-ignore
  const [showFiatBalance, setShowFiatBalance] = useState<boolean>(Number(cryptoBalance.replaceAll(',', '')) > 0 && network !== Network.testnet);

  


  useEffect(() => {
    if(!isToken){
      console.log(`----------  WalletRow中  不是token, 跳过.`);
      return;
    }
    if(!contract){
      console.log(`----------  WalletRow中  contract不存在, 跳过.`);
      return;
    }
    console.log(`----------  WalletRow中 WalletRow中, 当前渲染的token为  是否token = [${isToken}] 是否展示余额 = [${showFiatBalance}] chain = [${chain}] currencyName = [${currencyName}]  currencyAbbreviation = [${currencyAbbreviation}] walletName = [${walletName}] cryptoBalance = [${cryptoBalance}] fiatBalance = [${fiatBalance}]`);
    console.log(`----------  WalletRow中 当前详细钱包数据 currentWallet = [${JSON.stringify(currentWallet)}]`);
    contract.balanceOf(currentWallet.receiveAddress).then((value: any) => {
      const decimals = decimalsMap[currencyAbbreviation] || 18;
      const formatCryptoBalance = ethers.utils.formatUnits(value.toString(), decimals);
      console.log(`----------  WalletRow中 查询到当前代币余额. 原始值 = [${value.toString()}] formatCryptoBalance = [${formatCryptoBalance}] decimals = [${decimals}]`);
      setFinalCryptoBalance(formatCryptoBalance);
      setShowFiatBalance(Number(value.toString()) > 0);
      updateBalance(wallet.id, Number(value.toString()));
    });
  }, [isToken]);



  return (
    <RowContainer
      activeOpacity={ActiveOpacity}
      onPress={onPress}
      style={{borderBottomWidth: isLast || !hideIcon ? 0 : 1}}>
      {isToken && (
        <NestedArrowContainer>
          <NestedArrowIcon />
        </NestedArrowContainer>
      )}
      {!hideIcon ? (
        <CurrencyImageContainer>
          <CurrencyImage img={img} badgeUri={badgeImg} size={45} />
        </CurrencyImageContainer>
      ) : null}
      <CurrencyColumn>
        <Row>
          <H5 ellipsizeMode="tail" numberOfLines={1}>
            {walletName || currencyName}
          </H5>
        </Row>
        <Row style={{alignItems: 'center'}}>
          <ListItemSubText
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{marginTop: Platform.OS === 'ios' ? 2 : 0}}>
            {currencyAbbreviation.toUpperCase()}{' '}
            {multisig ? `${multisig} ` : null}
          </ListItemSubText>
          {buildTestBadge(network, chain, isToken)}
        </Row>
      </CurrencyColumn>
      <BalanceColumn>
        {!hideBalance ? (
          <>
            <H5 numberOfLines={1} ellipsizeMode="tail">
              {finalCryptoBalance}
            </H5>
            {showFiatBalance && (
              <ListItemSubText textAlign={'right'}>
                {network === 'testnet' ? 'Test - No Value' : finalFiatBalance}
              </ListItemSubText>
            )}
          </>
        ) : (
          <H5>****</H5>
        )}
      </BalanceColumn>
    </RowContainer>
  );
};

export default memo(WalletRow);
