import React, { useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@react-navigation/native';

interface QRCodeComponentProps {
  value: string;
  logoSize?: number;
  size?: number;
  ecl?: 'H' | 'Q' | 'M' | 'L';
  onError?: () => void;
}

interface ActionIcons {
  iconType: 'SYSTEM';
  iconValue: string;
}

interface ActionType {
  Share: 'share';
  Copy: 'copy';
}

const actionKeys: ActionType = {
  Share: 'share',
  Copy: 'copy',
};

interface ActionIcons {
  iconType: 'SYSTEM';
  iconValue: string;
}

const actionIcons: { [key: string]: ActionIcons } = {
  Share: {
    iconType: 'SYSTEM',
    iconValue: 'square.and.arrow.up',
  },
  Copy: {
    iconType: 'SYSTEM',
    iconValue: 'doc.on.doc',
  },
};

const QRCodeComponent: React.FC<QRCodeComponentProps> = ({
  value = '',
  logoSize = 90,
  size = 300,
  ecl = 'H',
  onError = () => {},
}) => {
  const qrCode = useRef<any>();
  const { colors } = useTheme();

  const renderQRCode = (
    <QRCode
      value={value}
      size={size}
      logoSize={logoSize}
      color="#000000"
      // @ts-ignore: logoBackgroundColor is not in the type definition
      logoBackgroundColor={colors.brandingColor}
      backgroundColor="#FFFFFF"
      ecl={ecl}
      getRef={(c: any) => (qrCode.current = c)}
      onError={onError}
    />
  );

  return (
    <View style={styles.qrCodeContainer} testID="BitcoinAddressQRCodeContainer">
      {
        renderQRCode
      }
    </View>
  );
};

export default QRCodeComponent;

const styles = StyleSheet.create({
  qrCodeContainer: { borderWidth: 6, borderRadius: 8, borderColor: '#FFFFFF' },
});
