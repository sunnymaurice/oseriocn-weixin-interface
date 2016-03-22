# Wechat App Front-end API for china oserio project
=======================================
# Version
1.0.0

# API
## request
- [getJsConfigSign](#getJsConfigSign)
- [getOAuthToken](#getOAuthToken)
- [getUserInfo](#getUserInfo)
- [setUserInfo](#setUserInfo)
- [getBodyInfo](#getBodyInfo)
- [getDeviceList](#getDeviceList)
- [unbindDevice](#unbindDevice)

====================
## getJsConfigSign

前端網頁傳送網頁URL給後端伺服器，要求生成啟用JSSDK所需的簽名。

### method 
__POST__

POST `/front-end-api/jssdk?action=getJsConfigSign`

#### POST parameters
    {
        url: "http://host.domain.name/webpage"
    }

### JSON response
    {
        appId: "wxe55f5egd8bd2d645",
        timestamp: "1458400688",
        nonceStr: "1282991227",
        signature: "e9e23a04136c5749063a4585a3150df58aec4bda"
    }

====================
## getOAuthToken

向後台索取網頁授權的Access Token。

### method 
__POST__

POST `/front-end-api/jssdk?action=getOAuthToken`

#### POST parameters
    {
        code: "01167eda5f5f5d78eb252060f961c8fr",
        state: "STATE"
    }

### JSON response
    {
        access_token: "OezXcEiiBSKSxW0eoylIeD2sWDPK_-ckMgbY4OkprydHFprJ8kJFpQdaG2Ly2lJfaUpQJZyQ3AsxE5U-r76eaPa13GhTtZLzB9QytT9BESdhkB_UiSbW2QL8AFa785bus_gJvsNc89DDXVkKkI-7XA"
        expires_in: 7200
        openid: "omBJDwkHA_mgH4qJmkFYThuksEj4"
        refresh_token: "OezXcEiiBSKSxW0eoylIeD2sWDPK_-ckMgbY4OkprydHFprJ8kJFpQdaG2Ly2lJfbsc9jWHAirK0PYAkiaglew43vg88GyqZv10Otp1PUrdEtUsb-MWcyx6FiK8va9euVvGWZSNnMWNJ5WE6cxVJoQ"
        scope: "snsapi_base"
    }

====================
## getUserInfo

要求取得當前使用者的使用者資料，後端伺服器使用網頁授權後取得的Access Token提取使用者資料

### method 
__POST__

POST `/front-end-api/user?action=getUserInfo`

#### POST parameters
    {
        access_token: "OezXcEiiBSKSxW0eoylIeD2sWDPK_-ckMgbY4OkprydHFprJ8kJFpQdaG2Ly2lJfaUpQJZyQ3AsxE5U-r76eaPa13GhTtZLzB9QytT9BESdhkB_UiSbW2QL8AFa785bus_gJvsNc89DDXVkKkI-7XA",
        openid: "omBJDwkHA_mgH4qJmkFYThuksEj4",
        lang: "zh-TW"
    }

### JSON response
    {
        city: "",
        country: "Taiwan",
        headimgurl: "http://wx.qlogo.cn/mmopen/ajNVdqHZLLBo6NCxAg7dj0N3UtrMF5dtm4jG5d4kXEf13J3A9Tk528nD3Tgp7urXxPaV7QjaicH0WsdUgPUjh2Mc6aBpzELJTM00UA5b2pHo/0",
        language: "zh_TW",
        nickname: "潘銘和",
        openid: "omBJDwkHA_mgH4qJmkFYThuksEj4",
        privilege: [],
        province: "Taichung City",
        sex: 1
    }
    
====================
## setUserInfo

儲存使用者的使用者資訊至後端伺服器儲存(身高、目標體重等其他設定)

### method 
__POST__

POST `/front-end-api/user?action=setUserInfo`

#### POST parameters
    {
        openid: "omBJDwkHA_mgH4qJmkFYThuksEj4",
        nickname: "潘銘和",
        sex: 1,
        birthday: "1970-01-01"
        height: 172.5,
        goal_weight: "60.5"
    }
### JSON response
    {}

====================
## getBodyInfo

取得使用者的所有身體資訊清單

### method 
__POST__

POST `/front-end-api/user?action=getBodyInfo`

#### POST parameters
    {
        openid: "omBJDwkHA_mgH4qJmkFYThuksEj4"
    }
### JSON response
    {
        data: [{
            date: "2016-01-01",
            time: "12:03:45",
            weight: 65.2,
            bodyfat: 15.6,
        }, {
            date: "2016-01-02",
            time: "11:12:36",
            weight: 55.2,
            bodyfat: 14.3
        }]
    }

====================
## getDeviceList

取得使用者已綁定的裝置清單

### method 
__POST__

POST `/front-end-api/device?action=getDeviceList`

#### POST parameters
    {
        openid: "omBJDwkHA_mgH4qJmkFYThuksEj4"
    }
    
### JSON response
    {
        待補
    }
    
====================
## unbindDevice

使用者解除綁定的裝置

### method 
__DELETE__

DELETE `/front-end-api/device?action=unbindDevice`

#### POST parameters
    {
        待補
    }
    
### JSON response
    {
        待補
    }
