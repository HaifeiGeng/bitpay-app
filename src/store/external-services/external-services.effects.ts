import axios from 'axios';

const uri = 'https://bws.bitpay.com/bws/api';
// const uri = 'http://10.100.201.52:3232/bws/api';

export const getExternalServicesConfig = async () => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const {data} = await axios.get(uri + '/v1/services', config);

    return Promise.resolve(data);
  } catch (err) {
    return Promise.reject(err);
  }
};
