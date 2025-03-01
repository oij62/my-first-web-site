const express = require('express');  
const app = express();  

const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'database.sqlite' });

// ✅ 가격 변동 추적을 위한 모델 정의 (INDEX 추가)
const PriceHistory = sequelize.define('PriceHistory', {
    query: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    link: { type: DataTypes.STRING, allowNull: false },
    image: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.INTEGER, allowNull: false }
}, {
    indexes: [
        { unique: false, fields: ['query', 'title'] } // 검색 속도 향상
    ]
});

// ✅ 테이블 동기화 (자동 생성)
(async () => { await PriceHistory.sync(); })();

app.set('view engine', 'ejs'); 

// ✅ 기본 페이지 (검색 입력 폼)
app.get('/', (req, res) => {
    res.render('index');
});

// ✅ 네이버 쇼핑 API 검색 라우트
app.get('/search', async (req, res) => {
    const query = req.query.q || '아이폰';

    try {
        const response = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}`, {
            headers: {
                'X-Naver-Client-Id': 'b77dLJB2PAFaHjemQque',
                'X-Naver-Client-Secret': 'ryLeDryOxF'
            }
        });

        const data = await response.json();
        res.render('search', { results: data.items, query });
    } catch (error) {
        console.error(error);
        res.status(500).send("API 요청 중 오류 발생!");
    }
});

// ✅ 속도 개선된 가격 저장 기능
app.get('/price', async (req, res) => {
    const query = req.query.q || '아이폰 15';

    try {
        const response = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}`, {
            headers: {
                'X-Naver-Client-Id': 'b77dLJB2PAFaHjemQque',
                'X-Naver-Client-Secret': 'ryLeDryOxF'
            }
        });

        const data = await response.json();
        const newData = [];

        await Promise.all(data.items.map(async (item) => {
            const cleanTitle = item.title.replace(/<\/?b>/g, ""); // ✅ <b> 태그 제거

            const existingItem = await PriceHistory.findOne({
                where: { query, title: cleanTitle }
            });

            if (!existingItem || existingItem.price !== parseInt(item.lprice)) {
                newData.push({
                    query,
                    title: cleanTitle,
                    link: item.link,
                    image: item.image,
                    price: parseInt(item.lprice)
                });
            }
        }));

        if (newData.length > 0) {
            await PriceHistory.bulkCreate(newData);  // ✅ 여러 개를 한 번에 저장
        }

        res.render('price', { results: data.items, query });

    } catch (error) {
        console.error(error);
        res.status(500).send("API 요청 중 오류 발생!");
    }
});

// ✅ 가격 변동 내역을 조회할 /history 페이지 추가
app.get('/history', async (req, res) => {
    const history = await PriceHistory.findAll({ order: [['createdAt', 'DESC']] });
    res.render('history', { history });
});

// ✅ 오래된 데이터 삭제 (6개월 이상된 데이터 정리)
app.get('/cleanup', async (req, res) => {
    try {
        await PriceHistory.destroy({
            where: {
                createdAt: { [Sequelize.Op.lt]: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
            }
        });
        res.send("✅ 오래된 데이터 정리 완료!");
    } catch (error) {
        console.error(error);
        res.status(500).send("데이터 정리 중 오류 발생!");
    }
});

// ✅ 서버 실행
app.listen(3000, () => {
    console.log('✅ 서버 실행 중: http://localhost:3000');
});
