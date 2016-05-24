/// <reference path="../../../typings/tsd.d.ts" />

// 微信API參考
// https://github.com/node-webot/wechat-api

interface BaseToken {
    access_token: string;
    expires_datetime: Date;
}

interface JsapiTicket {
    ticket: string;
    expires_datetime: Date;
}

export class WeixinBridge {
    private request = require('request');
    private crypto = require('crypto');
    private sha1 = require('sha1');

    private mongodb: any;
    private wxcfg: any;
    private rtcfg: any;

    private baseToken: BaseToken;
    private jsapiTicket: JsapiTicket;

    public constructor(mongoDB, wxcfg, rtcfg) {
        this.mongodb = mongoDB;
        this.wxcfg = wxcfg;
        this.rtcfg = rtcfg;

        this.baseToken = null;
        this.jsapiTicket = null;
        
        console.log('WeixinBridge constructed');
    }

    /**
     發送http request至遠端伺服器
     @return {Promise<any>} 非同步工作的承諾；取得遠端回應後回調json結果
     */
    private sendRequest(options) {
        options.headers = { 'Content-Type': 'application/json' };
        return new Promise<any>((resolve, reject) => {
            this.request(options, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    console.log(body);

                    // 微信的回應會帶base_resp屬性
                    if (body && body.base_resp) { body = body.base_resp; }

                    // 檢查微信回應的錯誤訊息
                    if (body.errcode === 0) {
                        resolve(body);
                    } else {
                        console.log('### Weixin Request Error ###\n');
                        reject(body);
                    }
                } else {
                    console.log(error);
                    console.log('### Send Request Error ###\n');
                    reject(error);
                }
            });
        });
    }

    /**
     檢查緩存是否過期
     @retrun {boolean} 是否過期
     */
    public isExpires = (cache): boolean => {
        if (!cache) {
            return true;
        } else {
            return new Date().getTime() > cache.expires_datetime.getTime();
        }
    }


    /**
     使用公眾號設定的Token字串，檢查微信傳送過來的簽名是否正確
     @param {any} param 微信傳送過來的簽名JSON
     */
    public checkSignature = (param) => {
        // 按照字典排序
        let arr = [this.wxcfg.WX_TOKEN, param.timestamp, param.nonce].sort();

        // 連接字串並比對簽名
        if (this.sha1(arr.join('')) === param.signature) {
            return true;
        } else {
            return false;
        }
    };

    /**
     取得網頁授權重新導向的url位址
     @param {string} scope 網頁授權關注動作；snsapi_userinfo 指向需要使用者同意與否的網頁，snsapi_base 無指向確認網頁
     @param {string} state 預設都是STATE
     @param {string} redirect_uri 授權後重新導向的位址(需要進行URI編譯)
     */
    public getOauthRedirect(scope, state, redirect_uri) {
        console.log('WeixinBridge: getOauthRedirect');
        scope = scope ? scope : 'snsapi_userinfo';
        state = state ? state : '';
        redirect_uri = redirect_uri ? redirect_uri : encodeURIComponent(this.rtcfg.HOST_ADDRESS + this.rtcfg.WX_PREFIX + this.rtcfg.WX_OAUTH_REDIRECT);

        return this.wxcfg.OAUTH_URL_PREFIX + this.wxcfg.OAUTH_AUTHORIZE_URL +
            'appid=' + this.wxcfg.WX_APPID +
            '&redirect_uri=' + redirect_uri +
            '&response_type=code' +
            '&scope=' + scope +
            '&state=' + state +
            '#wechat_redirect';
    }

    /**
     取得基礎接口必須使用的AccessToken
     @return {Promise} 非同步工作的承諾；取得基礎接口的AccessToken後回覆json結果
     */
    public getBaseAccessToken() {
        console.log('WeixinBridge: getBaseAccessToken');
        return new Promise<any>((resolve, reject) => {

            // 向微信服務器要求access_token
            let getAccessToken = () => {
                this.sendRequest({
                    uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.CGI_BIN_URL + this.wxcfg.BASE_TOKEN_URL +
                        'grant_type=client_credential' +
                        '&appid=' + this.wxcfg.WX_APPID +
                        '&secret=' + this.wxcfg.WX_APPSECRET,
                    method: 'GET'
                }).then((json) => {
                    // 直接將到期秒數-60s後(提早1分鐘更換)與目前時間計算，記錄為到期時間
                    let expires_datetime = new Date();
                    expires_datetime.setSeconds(expires_datetime.getSeconds() + json.expires_in - 60);
                    if (!this.baseToken) {
                        this.baseToken = {
                            access_token: json.access_token,
                            expires_datetime: expires_datetime
                        };
                    } else {
                        this.baseToken.access_token = json.access_token;
                        this.baseToken.expires_datetime = expires_datetime;
                    }

                    // 將access_token緩存至mongodb
                    this.mongodb.updateBaseToken(this.baseToken).then(() => {
                        console.log('Refresh Weixin Base Access Token.');
                        resolve(this.baseToken);
                    });
                }, (error) => {
                    reject(error);
                });
            };

            // 檢查資料庫中的緩存access_token
            if (!this.baseToken) {
                // 從資料庫中取出緩存access_token
                this.mongodb.fetchBaseToken().then((token) => {
                    if (token === null) {
                        getAccessToken(); // 資料庫尚無access_token，向微信服務器要求access_token
                    } else {
                        this.baseToken = token;

                        if (this.isExpires(this.baseToken)) {
                            getAccessToken(); // 如果過期則發出要求給微信更新access_token
                        } else {
                            // 回傳尚未過期的access_token
                            resolve(this.baseToken);
                        }
                    }
                }, (error) => {
                    reject(error);
                });
            } else {
                if (this.isExpires(this.baseToken)) {
                    getAccessToken(); // 如果過期則發出要求給微信更新access_token
                } else {
                    // 回傳尚未過期的access_token
                    resolve(this.baseToken);
                }
            }
        });
    }

    /**
     取得微信生成簽名必須的Jsapi Ticket
     */
    private getJsapiTicket() {
        console.log('WeixinBridge: getJsapiTicket');
        return new Promise<any>((resolve, reject) => {

            // 向微信服務器要求Jsapi Ticket
            let getTicket = () => {
                this.getBaseAccessToken().then((token) => {
                    this.sendRequest({
                        uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.CGI_BIN_URL + this.wxcfg.JSAPI_TICKET_URL +
                        'access_token=' + token.access_token + '&type=jsapi',
                        method: 'GET'
                    }).then((json) => {
                        // 直接將到期秒數-60s後(提早1分鐘更換)與目前時間計算，記錄為到期時間
                        let expires_datetime = new Date();
                        expires_datetime.setSeconds(expires_datetime.getSeconds() + json.expires_in - 60);
                        if (!this.jsapiTicket) {
                            this.jsapiTicket = {
                                ticket: json.ticket,
                                expires_datetime: expires_datetime
                            };
                        } else {
                            this.jsapiTicket.ticket = json.ticket;
                            this.jsapiTicket.expires_datetime = expires_datetime;
                        }

                        // 更新jsapiTicket
                        this.mongodb.updateJsapiTicket(this.jsapiTicket).then(() => {
                            console.log('Refresh Weixin Jsapi Ticket.');
                            resolve(this.jsapiTicket);
                        }, (error) => {
                            reject(error);
                        });
                    }, (error) => {
                        reject(error);
                    });
                }, (error) => {
                    reject(error);
                });
            };

            // 檢查資料庫中的緩存jsapiTicket
            if (!this.jsapiTicket) {
                // 從資料庫中取出緩存jsapiTicket
                this.mongodb.fetchJsapiTicket().then((ticket) => {
                    if (!ticket) {
                        getTicket(); // 資料庫尚無jsapiTicket，向微信服務器要求jsapiTicket
                    } else {
                        this.jsapiTicket = ticket;
                        if (this.isExpires(this.jsapiTicket)) {
                            getTicket(); // 如果過期則發出要求給微信更新jsapiTicket
                        } else {
                            // 回傳尚未過期的jsapiTicket
                            resolve(this.jsapiTicket);
                        }
                    }
                }, (error) => {
                    reject(error);
                });
            } else {
                // 已有存在的jsapiTicket，是否過期
                if (this.isExpires(this.jsapiTicket)) {
                    getTicket(); // 如果過期則發出要求給微信更新jsapiTicket
                } else {
                    // 回傳尚未過期的jsapiTicket
                    resolve(this.jsapiTicket);
                }
            }
        });
    }

    /**
     取得前端網頁需要啟用微信JSSDK的簽名組態
     @param {string} url 前端網頁目前的url位址(由前端網頁POST)
     @return {Promise} 非同步工作的承諾；計算出簽名後回覆json結果
     */
    public getJsConfigSign(url) {
        console.log('WeixinBridge: getJsConfigSign');

        // 提供數據不完整則返回空數據
        if (!url) {
            return new Promise((resolve, reject) => { reject(); });
        } else {
            return new Promise<any>((resolve, reject) => {
                this.getJsapiTicket().then((ticket) => {
                    let nonceStr = Math.random().toString(36).substr(2, 15); // 生成隨機字串
                    let timestamp = String(Math.floor(new Date().getTime() / 1000)); // 生成時戳
                    let signature = ((tc, ns, ts, u) => {
                        let rawStr = ((args) => {
                            let newArgs = {};

                            // 排序查詢字串
                            let keys = Object.keys(args).sort();
                            keys.forEach((key) => { newArgs[key.toLowerCase()] = args[key]; });

                            let str = '';
                            for (let k in newArgs) { str += '&' + k + '=' + newArgs[k]; }
                            return str.substr(1);
                        })({
                            jsapi_ticket: tc.ticket,
                            nonceStr: ns,
                            timestamp: ts,
                            url: u
                        });

                        let shasum = this.crypto.createHash('sha1'); // 創建sha1編碼物件
                        shasum.update(rawStr); // 將簽名字串進行sha1加密編碼
                        return shasum.digest('hex');
                    })(ticket, nonceStr, timestamp, url);

                    resolve({
                        appId: this.wxcfg.WX_APPID,
                        timestamp: timestamp,
                        nonceStr: nonceStr,
                        signature: signature
                    });
                }, (error) => {
                    reject(error);
                });
            });
        }
    };

    /**
     使用授權碼索取網頁授權的Access Token
     @param {string} code 網頁授權後重新導向後所取得的授權碼
     @return {Promise} 非同步工作的承諾；取得Access Token後，攜帶json回覆
     */
    public getOauthToken(code) {
        console.log('WeixinBridge: getOauthToken');
        // 提供數據不完整則返回空數據
        if (!code) {
            return new Promise((resolve, reject) => { reject('Get oauth access token need a code string.'); });
        } else {
            return new Promise<any>((resolve, reject) => {
                this.sendRequest({
                    uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.OAUTH_TOKEN_URL +
                    'appid=' + this.wxcfg.WX_APPID +
                    '&secret=' + this.wxcfg.WX_APPSECRET +
                    '&code=' + code +
                    '&grant_type=authorization_code',
                    method: 'GET'
                }).then((json) => {
                    resolve(json);
                }, (error) => {
                    reject(error);
                });
            });
        }
    }

    /**
     使用基礎支援的Access Token取得使用者的基本資訊
     @param {string} openid 已關注的客戶端維一的id
     @return {Promise} 非同步工作的承諾；取得使用者基本資訊後回覆json結果
     */
    public getUserInfo(openid, lang) {
        console.log('WeixinBridge: getUserInfo');

        // 提供數據不完整則返回空數據
        if (!openid) {
            return new Promise<any>((resolve, reject) => { reject('invaild openid'); });
        } else {
            return new Promise<any>((resolve, reject) => {

                // 從資料庫撈出使用者資料
                this.mongodb.fetchWeixinUser(openid).then((db_userInfo) => {
                    let runRequestUserInfo = () => {
                        this.getBaseAccessToken().then((token) => {
                            this.sendRequest({
                                uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.CGI_BIN_URL + this.wxcfg.USER_INFO_URL +
                                'access_token=' + token.access_token +
                                '&openid=' + openid +
                                '&lang=' + (lang ? lang : 'zh_CN'),
                                method: 'GET'
                            }).then((json) => {
                                // 更新資料庫中的用戶基本資訊
                                this.mongodb.updateWeixinUser(json).then(() => {
                                    resolve({
                                        openid: json.openid,
                                        nickname: json.nickname,
                                        headimgurl: json.headimgurl,
                                        sex: json.sex
                                    });
                                });
                            }, (error) => {
                                reject(error);
                            });
                        }, (error) => {
                            reject(error);
                        });
                    };

                    // 如果資料庫裡沒有使用者資料，再向微信伺服器索取使用者資料
                    if (!db_userInfo) {
                        runRequestUserInfo();
                    } else {
                        if (!db_userInfo.nickname || !db_userInfo.headimgurl) {
                            runRequestUserInfo();
                        } else {
                            resolve({
                                openid: db_userInfo.openid,
                                nickname: db_userInfo.nickname,
                                headimgurl: db_userInfo.headimgurl,
                                sex: db_userInfo.sex,
                                birthday: db_userInfo.birthday,
                                height: db_userInfo.height,
                                goal_weight: db_userInfo.goal_weight,
                            });
                        }
                    }
                });
            });
        }
    }

    /**
     解除使用者綁定的裝置設備
     @param {string} openid 已關注的客戶端唯一的id
     @param {string} device_id 裝置唯一的id
     @return {Promise} 非同步工作的承諾；取得微信解除綁定後，回覆微信json結果
     */
    public unbindUserDevice(openid, device_id) {
        console.log('WeixinBridge: unbindUserDevice');

        // 提供數據不完整則返回空數據
        if (!openid || !device_id) {
            return new Promise<any>((resolve, reject) => { reject('invaild openid or device_id'); });
        } else {
            return new Promise<any>((resolve, reject) => {
                this.getBaseAccessToken().then((token) => {
                    this.sendRequest({
                        uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.DEVICE_URL_PREFIX + this.wxcfg.FORCE_UNBIND_URL +
                        'access_token=' + token.access_token,
                        method: 'POST',
                        json: { openid: openid, device_id: device_id }
                    }).then((response) => {
                        // // 微信成功處理完解除綁定後，處理本地端資料庫；刪除使用者關聯的裝置
                        // this.mongodb.removeUserBindDevice(openid, device_id).then(() => {
                        //     resolve(response);
                        // });
                        resolve(response);
                    }, (error) => {
                        reject(error);
                    });
                }, (error) => {
                    reject(error);
                });
            });
        }
    }

    /**
     取得使用者已綁定的裝置設備清單
     @param {string} openid 已關注的客戶端唯一的id
     @return {Promise} 非同步工作的承諾；取得清單後，回覆微信json結果
     */
    public getBindDevice(openid) {
        console.log('WeixinBridge: getBindDevice');

        // 提供數據不完整則返回空數據
        if (!openid) {
            return new Promise<any>((resolve, reject) => { reject('invaild openid'); });
        } else {
            return new Promise<any>((resolve, reject) => {
                this.getBaseAccessToken().then((token) => {
                    this.sendRequest({
                        uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.DEVICE_URL_PREFIX + this.wxcfg.GET_BIND_DEVICE_URL +
                        'access_token=' + token.access_token + '&openid=' + openid,
                        method: 'GET'
                    }).then((response) => {
                        if (response && response.device_list) {
                            resolve(response.device_list);
                        } else {
                            reject(response.resp_msg);
                        }
                    }, (error) => {
                        reject(error);
                    });
                }, (error) => {
                    reject(error);
                });
            });
        }
    }

    /**
     發送客服訊息至用戶
     */
    public sendMessageToUser(openid, msgtype, data) {
        console.log('WeixinBridge: sendMessageToUser');

        return new Promise<any>((resolve, reject) => {
            this.getBaseAccessToken().then((token) => {
                this.sendRequest({
                    uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.CGI_BIN_URL + this.wxcfg.MESSAGE_CUSTOM_SEND +
                    'access_token=' + token.access_token,
                    method: 'POST',
                    json: {
                        touser: openid,
                        msgtype: msgtype,
                        [msgtype]: data
                    }
                }).then((response) => {
                    if (response.errcode === 0) {
                        resolve(response); // 成功發送給用戶
                    } else {
                        reject(response); // 成功發送要求，但未成功發送至用戶
                    }
                }, (error) => {
                    reject(error);
                });
            }, (error) => {
                reject(error);
            });
        });
    }

    /**
     發送模板訊息至用戶
     */
    public sendTemplateToUser(openid, template_id, url, data) {
        console.log('WeixinBridge: sendTemplateToUser');

        return new Promise<any>((resolve, reject) => {
            this.getBaseAccessToken().then((token) => {
                this.sendRequest({
                    uri: this.wxcfg.API_URL_PREFIX + this.wxcfg.CGI_BIN_URL + this.wxcfg.MESSAGE_TEMPLATE_SEND +
                    'access_token=' + token.access_token,
                    method: 'POST',
                    json: {
                        touser: openid,
                        template_id: template_id,
                        url: url,
                        data: data
                    }
                }).then((response) => {
                    if (response.errcode === 0) {
                        resolve(response); // 成功發送給用戶
                    } else {
                        reject(response); // 成功發送要求，但未成功發送至用戶
                    }
                }, (error) => {
                    reject(error);
                });
            }, (error) => {
                reject(error);
            });
        });
    }
}