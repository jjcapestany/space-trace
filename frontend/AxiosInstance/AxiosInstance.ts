import axios from 'axios';

/*
 * This is a singleton that will load on all the interceptors.
 *
 * Use this instead of directly importing axios.
 */

axios.defaults.headers.post[`Content-Type`] = `application/json;charset=utf-8`;
axios.defaults.headers.post[`Access-Control-Allow-Origin`] = `*`;
axios.defaults.withCredentials = true;
const axiosInstance = () => {
  return axios.create();
};

export default axiosInstance();
