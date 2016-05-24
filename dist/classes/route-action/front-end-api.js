/// <reference path="../../../typings/tsd.d.ts" />
"use strict";
var ActionFrontEndAPI = (function () {
    function ActionFrontEndAPI(mongodb, wxapi, rtcfg, event) {
        /**
         * 以json回應要求
         * @param {any} res remote response to client
         * @param {any} json 欲發送的json
         */
        this.responseJSON = function (res, json) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.type('json');
            res.status(200).json(json);
        };
        this.mongodb = mongodb;
        this.wxapi = wxapi;
        this.rtcfg = rtcfg;
        this.event = event; // 事件廣播器
    }
    /**
     * 將網頁路徑重新導向授權頁
     * @param {any} req remote request from client
     * @param {any} res remote response to client
     */
    ActionFrontEndAPI.prototype.oauthCheck = function (req, res) {
        if (!req.query.entrypage) {
            req.query.entrypage = 'home';
        } // 沒有指定進入頁面，預設為首頁
        res.writeHead(302, { Location: this.wxapi.getOauthRedirect('snsapi_base', req.query.entrypage) });
        res.end();
    };
    /**
     * 網頁重新導向後的處理動作
     * @param {any} req remote request from client
     * @param {any} res remote response to client
     */
    ActionFrontEndAPI.prototype.oauthRedirect = function (req, res) {
        var _this = this;
        this.wxapi.getOauthToken(req.query.code).then(function (oauth) {
            // 根據使用者不同地區國家對應不同資訊；目前只支援zh_TW, en_US, zh_CN
            var userLang = req.headers['accept-language'];
            if (userLang.indexOf('zh-TW') >= 0) {
                userLang = 'zh_TW';
            }
            else if (userLang.indexOf('en-US') >= 0) {
                userLang = 'en_US';
            }
            else {
                userLang = 'zh_CN';
            }
            // 拉取用戶基本資料
            _this.wxapi.getUserInfo(oauth.openid, userLang).then(function (userInfo) {
                // 更新完用戶基本資料後，再導向網頁
                res.writeHead(302, {
                    Location: _this.rtcfg.HOST_ADDRESS +
                        _this.rtcfg.WX_PREFIX +
                        _this.rtcfg.WX_WEBPAGE +
                        '?openid=' + userInfo.openid +
                        (req.query.state ? '&entrypage=' + req.query.state : '')
                });
                res.end();
            }, function (error) {
                console.log(error);
                res.status(400).send();
            });
        }, function (error) {
            console.log(error);
            res.status(400).send();
        });
    };
    /**
     * 生成前端JSSDK所需的SDK簽名
     * @param {any} req remote request from client
     * @param {any} res remote response to client
     */
    ActionFrontEndAPI.prototype.jsSign = function (req, res) {
        var _this = this;
        switch (req.query.action) {
            case 'getJsConfigSign':
                console.log('\naction: getJsConfigSign');
                this.wxapi.getJsConfigSign(req.body.url).then(function (sign) {
                    _this.responseJSON(res, sign);
                }, function (error) {
                    console.log(error);
                    res.status(400).send();
                });
                break;
            default:
                this.responseJSON(res, { errmsg: 'unknown action' });
                break;
        }
    };
    /**
     * 處理使用者資料相關要求
     * @param {any} req remote request from client
     * @param {any} res remote response to client
     */
    ActionFrontEndAPI.prototype.user = function (req, res) {
        var _this = this;
        switch (req.query.action) {
            case 'getUserInfo':
                console.log('\naction: getUserInfo');
                // request body example:
                // { openid: "omBJDwkHA_mgH4qJmkFYThuksEj4" }
                // 根據使用者不同地區國家對應不同資訊；目前只支援zh_TW, en_US, zh_CN
                var userLang = req.headers['accept-language'];
                if (userLang.indexOf('zh-TW') >= 0) {
                    userLang = 'zh_TW';
                }
                else if (userLang.indexOf('en-US') >= 0) {
                    userLang = 'en_US';
                }
                else {
                    userLang = 'zh_CN';
                }
                this.wxapi.getUserInfo(req.body.openid, userLang).then(function (userInfo) {
                    _this.responseJSON(res, userInfo);
                }, function (error) {
                    console.log(error);
                    res.status(400).send();
                });
                break;
            case 'updateUserInfo':
                console.log('\naction: updateUserInfo');
                // request body example:
                // {
                //     openid: "omBJDwkHA_mgH4qJmkFYThuksEj4",
                //     nickname: "潘銘和",
                //     sex: "1",
                //     birthday: "1970-01-01"
                //     height: "172.5",
                //     goal_weight: "60.5"
                // }
                this.mongodb.updateWeixinUser(req.body).then(function () {
                    _this.responseJSON(res, { errcode: 0, errmsg: 'ok' });
                });
                break;
            default:
                this.responseJSON(res, { errmsg: 'unknown action' });
                break;
        }
    };
    /**
     * 處理使用者裝置相關要求
     * @param {any} req remote request from client
     * @param {any} res remote response to client
     */
    ActionFrontEndAPI.prototype.device = function (req, res) {
        var _this = this;
        console.log(req.body);
        switch (req.query.action) {
            case 'getDeviceListByUser':
                // this.mongodb.fetchUserDeviceList(req.body.openid).then((device_list) => {
                //     this.responseJSON(res, device_list);
                // });
                this.wxapi.getBindDevice(req.body.openid).then(function (device_list) {
                    _this.event.emit('frontend.fetchDeviceDetail', {
                        openid: req.body.openid,
                        device_list: device_list
                    }, res);
                    // this.responseJSON(res, device_list); // 回應前端要求
                }, function (error) {
                    res.status(400).send(error);
                });
                break;
            case 'getDeviceInfo':
                this.mongodb.fetchDeviceInfo(req.body.device_id).then(function (device_info) {
                    _this.responseJSON(res, device_info);
                });
                break;
            case 'getDeviceDetail':
                this.event.emit('frontend.fetchDeviceStatus', {
                    openid: req.body.openid,
                    device_id: req.body.device_id
                }, res);
                break;
            case 'unbindDevice':
                this.wxapi.unbindUserDevice(req.body.openid, req.body.device_id).then(function (weixinJson) {
                    _this.responseJSON(res, weixinJson); // 回應前端要求
                }, function (error) {
                    res.status(400).send();
                });
                break;
            default:
                this.responseJSON(res, { errmsg: 'unknown action' });
                break;
        }
    };
    return ActionFrontEndAPI;
}());
exports.ActionFrontEndAPI = ActionFrontEndAPI;
