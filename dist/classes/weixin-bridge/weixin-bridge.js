/// <reference path="../../../typings/tsd.d.ts" />
"use strict";
var WeixinBridge = (function () {
    function WeixinBridge(mongoDB, wxcfg, rtcfg) {
        var _this = this;
        this.request = require('request');
        this.crypto = require('crypto');
        this.sha1 = require('sha1');
        /**
         檢查緩存是否過期
         @retrun {boolean} 是否過期
         */
        this.isExpires = function (cache) {
            if (!cache) {
                return true;
            }
            else {
                return new Date().getTime() > cache.expires_datetime.getTime();
            }
        };
        /**
         使用公眾號設定的Token字串，檢查微信傳送過來的簽名是否正確
         @param {any} param 微信傳送過來的簽名JSON
         */
        this.checkSignature = function (param) {
            // 按照字典排序
            var arr = [_this.wxcfg.WX_TOKEN, param.timestamp, param.nonce].sort();
            // 連接字串並比對簽名
            if (_this.sha1(arr.join('')) === param.signature) {
                return true;
            }
            else {
                return false;
            }
        };
        this.mongodb = mongoDB;
        this.wxcfg = wxcfg;
        this.rtcfg = rtcfg;
        this.baseToken = null;
        this.jsapiTicket = null;
    }
    /**
     發送http request至遠端伺服器
     @return {Promise<any>} 非同步工作的承諾；取得遠端回應後回調json結果
     */
    WeixinBridge.prototype.sendRequest = function (options) {
        var _this = this;
        options.headers = { 'Content-Type': 'application/json' };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    // 微信的回應會帶base_resp屬性
                    if (body && body.base_resp) {
                        body = body.base_resp;
                    }
                    // 檢查微信回應的錯誤訊息
                    if (body.errcode === 0) {
                        resolve(body);
                    }
                    else {
                        console.error('### Weixin Request Error ###\n');
                        reject(body);
                    }
                }
                else {
                    console.error(error);
                    console.error('### Send Request Error ###\n');
                    reject(error);
                }
            });
        });
    };
    /**
     取得網頁授權重新導向的url位址
     @param {string} scope 網頁授權關注動作；snsapi_userinfo 指向需要使用者同意與否的網頁，snsapi_base 無指向確認網頁
     @param {string} state 預設都是STATE
     @param {string} redirect_uri 授權後重新導向的位址(需要進行URI編譯)
     */
    WeixinBridge.prototype.getOauthRedirect = function (scope, state, redirect_uri) {
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
    };
    /**
     取得基礎接口必須使用的AccessToken
     @return {Promise} 非同步工作的承諾；取得基礎接口的AccessToken後回覆json結果
     */
    WeixinBridge.prototype.getBaseAccessToken = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            // 向微信服務器要求access_token
            var getAccessToken = function () {
                _this.sendRequest({
                    uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.CGI_BIN_URL + _this.wxcfg.BASE_TOKEN_URL +
                        'grant_type=client_credential' +
                        '&appid=' + _this.wxcfg.WX_APPID +
                        '&secret=' + _this.wxcfg.WX_APPSECRET,
                    method: 'GET'
                }).then(function (json) {
                    // 直接將到期秒數-60s後(提早1分鐘更換)與目前時間計算，記錄為到期時間
                    var expires_datetime = new Date();
                    expires_datetime.setSeconds(expires_datetime.getSeconds() + json.expires_in - 60);
                    if (!_this.baseToken) {
                        _this.baseToken = {
                            access_token: json.access_token,
                            expires_datetime: expires_datetime
                        };
                    }
                    else {
                        _this.baseToken.access_token = json.access_token;
                        _this.baseToken.expires_datetime = expires_datetime;
                    }
                    // 將access_token緩存至mongodb
                    _this.mongodb.updateBaseToken(_this.baseToken).then(function () {
                        resolve(_this.baseToken);
                    });
                }, function (error) {
                    reject(error);
                });
            };
            // 檢查資料庫中的緩存access_token
            if (!_this.baseToken) {
                // 從資料庫中取出緩存access_token
                _this.mongodb.fetchBaseToken().then(function (token) {
                    if (token === null) {
                        getAccessToken(); // 資料庫尚無access_token，向微信服務器要求access_token
                    }
                    else {
                        _this.baseToken = token;
                        if (_this.isExpires(_this.baseToken)) {
                            getAccessToken(); // 如果過期則發出要求給微信更新access_token
                        }
                        else {
                            // 回傳尚未過期的access_token
                            resolve(_this.baseToken);
                        }
                    }
                }, function (error) {
                    reject(error);
                });
            }
            else {
                if (_this.isExpires(_this.baseToken)) {
                    getAccessToken(); // 如果過期則發出要求給微信更新access_token
                }
                else {
                    // 回傳尚未過期的access_token
                    resolve(_this.baseToken);
                }
            }
        });
    };
    /**
     取得微信生成簽名必須的Jsapi Ticket
     */
    WeixinBridge.prototype.getJsapiTicket = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            // 向微信服務器要求Jsapi Ticket
            var getTicket = function () {
                _this.getBaseAccessToken().then(function (token) {
                    _this.sendRequest({
                        uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.CGI_BIN_URL + _this.wxcfg.JSAPI_TICKET_URL +
                            'access_token=' + token.access_token + '&type=jsapi',
                        method: 'GET'
                    }).then(function (json) {
                        // 直接將到期秒數-60s後(提早1分鐘更換)與目前時間計算，記錄為到期時間
                        var expires_datetime = new Date();
                        expires_datetime.setSeconds(expires_datetime.getSeconds() + json.expires_in - 60);
                        if (!_this.jsapiTicket) {
                            _this.jsapiTicket = {
                                ticket: json.ticket,
                                expires_datetime: expires_datetime
                            };
                        }
                        else {
                            _this.jsapiTicket.ticket = json.ticket;
                            _this.jsapiTicket.expires_datetime = expires_datetime;
                        }
                        // 更新jsapiTicket
                        _this.mongodb.updateJsapiTicket(_this.jsapiTicket).then(function () {
                            resolve(_this.jsapiTicket);
                        }, function (error) {
                            reject(error);
                        });
                    }, function (error) {
                        reject(error);
                    });
                }, function (error) {
                    reject(error);
                });
            };
            // 檢查資料庫中的緩存jsapiTicket
            if (!_this.jsapiTicket) {
                // 從資料庫中取出緩存jsapiTicket
                _this.mongodb.fetchJsapiTicket().then(function (ticket) {
                    if (!ticket) {
                        getTicket(); // 資料庫尚無jsapiTicket，向微信服務器要求jsapiTicket
                    }
                    else {
                        _this.jsapiTicket = ticket;
                        if (_this.isExpires(_this.jsapiTicket)) {
                            getTicket(); // 如果過期則發出要求給微信更新jsapiTicket
                        }
                        else {
                            // 回傳尚未過期的jsapiTicket
                            resolve(_this.jsapiTicket);
                        }
                    }
                }, function (error) {
                    reject(error);
                });
            }
            else {
                // 已有存在的jsapiTicket，是否過期
                if (_this.isExpires(_this.jsapiTicket)) {
                    getTicket(); // 如果過期則發出要求給微信更新jsapiTicket
                }
                else {
                    // 回傳尚未過期的jsapiTicket
                    resolve(_this.jsapiTicket);
                }
            }
        });
    };
    /**
     取得前端網頁需要啟用微信JSSDK的簽名組態
     @param {string} url 前端網頁目前的url位址(由前端網頁POST)
     @return {Promise} 非同步工作的承諾；計算出簽名後回覆json結果
     */
    WeixinBridge.prototype.getJsConfigSign = function (url) {
        var _this = this;
        // 提供數據不完整則返回空數據
        if (!url) {
            return new Promise(function (resolve, reject) { reject(); });
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.getJsapiTicket().then(function (ticket) {
                    var nonceStr = Math.random().toString(36).substr(2, 15); // 生成隨機字串
                    var timestamp = String(Math.floor(new Date().getTime() / 1000)); // 生成時戳
                    var signature = (function (tc, ns, ts, u) {
                        var rawStr = (function (args) {
                            var newArgs = {};
                            // 排序查詢字串
                            var keys = Object.keys(args).sort();
                            keys.forEach(function (key) { newArgs[key.toLowerCase()] = args[key]; });
                            var str = '';
                            for (var k in newArgs) {
                                str += '&' + k + '=' + newArgs[k];
                            }
                            return str.substr(1);
                        })({
                            jsapi_ticket: tc.ticket,
                            nonceStr: ns,
                            timestamp: ts,
                            url: u
                        });
                        var shasum = _this.crypto.createHash('sha1'); // 創建sha1編碼物件
                        shasum.update(rawStr); // 將簽名字串進行sha1加密編碼
                        return shasum.digest('hex');
                    })(ticket, nonceStr, timestamp, url);
                    resolve({
                        appId: _this.wxcfg.WX_APPID,
                        timestamp: timestamp,
                        nonceStr: nonceStr,
                        signature: signature
                    });
                }, function (error) {
                    reject(error);
                });
            });
        }
    };
    ;
    /**
     使用授權碼索取網頁授權的Access Token
     @param {string} code 網頁授權後重新導向後所取得的授權碼
     @return {Promise} 非同步工作的承諾；取得Access Token後，攜帶json回覆
     */
    WeixinBridge.prototype.getOauthToken = function (code) {
        var _this = this;
        // 提供數據不完整則返回空數據
        if (!code) {
            return new Promise(function (resolve, reject) { reject('Get oauth access token need a code string.'); });
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.sendRequest({
                    uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.OAUTH_TOKEN_URL +
                        'appid=' + _this.wxcfg.WX_APPID +
                        '&secret=' + _this.wxcfg.WX_APPSECRET +
                        '&code=' + code +
                        '&grant_type=authorization_code',
                    method: 'GET'
                }).then(function (json) {
                    resolve(json);
                }, function (error) {
                    reject(error);
                });
            });
        }
    };
    /**
     使用基礎支援的Access Token取得使用者的基本資訊
     @param {string} openid 已關注的客戶端維一的id
     @return {Promise} 非同步工作的承諾；取得使用者基本資訊後回覆json結果
     */
    WeixinBridge.prototype.getUserInfo = function (openid, lang) {
        var _this = this;
        // 提供數據不完整則返回空數據
        if (!openid) {
            return new Promise(function (resolve, reject) { reject('invaild openid'); });
        }
        else {
            return new Promise(function (resolve, reject) {
                // 從資料庫撈出使用者資料
                _this.mongodb.fetchWeixinUser(openid).then(function (db_userInfo) {
                    var runRequestUserInfo = function () {
                        _this.getBaseAccessToken().then(function (token) {
                            _this.sendRequest({
                                uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.CGI_BIN_URL + _this.wxcfg.USER_INFO_URL +
                                    'access_token=' + token.access_token +
                                    '&openid=' + openid +
                                    '&lang=' + (lang ? lang : 'zh_CN'),
                                method: 'GET'
                            }).then(function (json) {
                                // 更新資料庫中的用戶基本資訊
                                _this.mongodb.updateWeixinUser(json).then(function () {
                                    resolve({
                                        openid: json.openid,
                                        nickname: json.nickname,
                                        headimgurl: json.headimgurl,
                                        sex: json.sex
                                    });
                                });
                            }, function (error) {
                                reject(error);
                            });
                        }, function (error) {
                            reject(error);
                        });
                    };
                    // 如果資料庫裡沒有使用者資料，再向微信伺服器索取使用者資料
                    if (!db_userInfo) {
                        runRequestUserInfo();
                    }
                    else {
                        if (!db_userInfo.nickname || !db_userInfo.headimgurl) {
                            runRequestUserInfo();
                        }
                        else {
                            resolve({
                                openid: db_userInfo.openid,
                                nickname: db_userInfo.nickname,
                                headimgurl: db_userInfo.headimgurl,
                                sex: db_userInfo.sex,
                                birthday: db_userInfo.birthday,
                                height: db_userInfo.height,
                                goal_weight: db_userInfo.goal_weight
                            });
                        }
                    }
                });
            });
        }
    };
    /**
     解除使用者綁定的裝置設備
     @param {string} openid 已關注的客戶端唯一的id
     @param {string} device_id 裝置唯一的id
     @return {Promise} 非同步工作的承諾；取得微信解除綁定後，回覆微信json結果
     */
    WeixinBridge.prototype.unbindUserDevice = function (openid, device_id) {
        var _this = this;
        // 提供數據不完整則返回空數據
        if (!openid || !device_id) {
            return new Promise(function (resolve, reject) { reject('invaild openid or device_id'); });
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.getBaseAccessToken().then(function (token) {
                    _this.sendRequest({
                        uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.DEVICE_URL_PREFIX + _this.wxcfg.FORCE_UNBIND_URL +
                            'access_token=' + token.access_token,
                        method: 'POST',
                        json: { openid: openid, device_id: device_id }
                    }).then(function (response) {
                        // // 微信成功處理完解除綁定後，處理本地端資料庫；刪除使用者關聯的裝置
                        // this.mongodb.removeUserBindDevice(openid, device_id).then(() => {
                        //     resolve(response);
                        // });
                        resolve(response);
                    }, function (error) {
                        reject(error);
                    });
                }, function (error) {
                    reject(error);
                });
            });
        }
    };
    /**
     取得使用者已綁定的裝置設備清單
     @param {string} openid 已關注的客戶端唯一的id
     @return {Promise} 非同步工作的承諾；取得清單後，回覆微信json結果
     */
    WeixinBridge.prototype.getBindDevice = function (openid) {
        var _this = this;
        // 提供數據不完整則返回空數據
        if (!openid) {
            return new Promise(function (resolve, reject) { reject('invaild openid'); });
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.getBaseAccessToken().then(function (token) {
                    _this.sendRequest({
                        uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.DEVICE_URL_PREFIX + _this.wxcfg.GET_BIND_DEVICE_URL +
                            'access_token=' + token.access_token + '&openid=' + openid,
                        method: 'GET'
                    }).then(function (response) {
                        if (response && response.device_list) {
                            resolve(response.device_list);
                        }
                        else {
                            reject(response.resp_msg);
                        }
                    }, function (error) {
                        reject(error);
                    });
                }, function (error) {
                    reject(error);
                });
            });
        }
    };
    /**
     發送客服訊息至用戶
     */
    WeixinBridge.prototype.sendMessageToUser = function (openid, msgtype, data) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getBaseAccessToken().then(function (token) {
                _this.sendRequest({
                    uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.CGI_BIN_URL + _this.wxcfg.MESSAGE_CUSTOM_SEND +
                        'access_token=' + token.access_token,
                    method: 'POST',
                    json: (_a = {
                            touser: openid,
                            msgtype: msgtype
                        },
                        _a[msgtype] = data,
                        _a
                    )
                }).then(function (response) {
                    if (response.errcode === 0) {
                        resolve(response); // 成功發送給用戶
                    }
                    else {
                        reject(response); // 成功發送要求，但未成功發送至用戶
                    }
                }, function (error) {
                    reject(error);
                });
                var _a;
            }, function (error) {
                reject(error);
            });
        });
    };
    /**
     發送模板訊息至用戶
     */
    WeixinBridge.prototype.sendTemplateToUser = function (openid, template_id, url, data) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getBaseAccessToken().then(function (token) {
                _this.sendRequest({
                    uri: _this.wxcfg.API_URL_PREFIX + _this.wxcfg.CGI_BIN_URL + _this.wxcfg.MESSAGE_TEMPLATE_SEND +
                        'access_token=' + token.access_token,
                    method: 'POST',
                    json: {
                        touser: openid,
                        template_id: template_id,
                        url: url,
                        data: data
                    }
                }).then(function (response) {
                    if (response.errcode === 0) {
                        resolve(response); // 成功發送給用戶
                    }
                    else {
                        reject(response); // 成功發送要求，但未成功發送至用戶
                    }
                }, function (error) {
                    reject(error);
                });
            }, function (error) {
                reject(error);
            });
        });
    };
    return WeixinBridge;
}());
exports.WeixinBridge = WeixinBridge;
