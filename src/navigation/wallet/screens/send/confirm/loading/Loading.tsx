import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

const Loading = ({ text }: {text: string}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // 背景颜色，可以根据需要进行调整
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 99999,
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#ffffff', // 文字颜色，可以根据需要进行调整
  },
});

export default Loading;