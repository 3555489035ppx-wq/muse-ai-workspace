const timestamp = "2026-08-02T08:00:00.000Z";

import { createDemoVisualsFromIndustrial } from "./demoVisuals.js";

const imagePath = (slug, group, index) => {
  const visualSlug = `${slug}-v2`;
  return `/assets/portfolio/${visualSlug}/${visualSlug}-${group}-${String(index).padStart(2, "0")}.png`;
};
const idFor = (projectId, suffix) => `${projectId}-${suffix}`;

const projectSpecs = {
  "f1000000-0000-4000-8000-000000000101": {
    slug: "quiet-air-lighthouse",
    palette: ["#DDEBE2", "#8CB7B0", "#263A3C"],
    evidence: [
      ["夜间观察", "回家后先看光，再决定是否开机", "用户进入卧室时不会主动寻找复杂的空气数据，通常先通过窗帘、台灯和体感判断空间是否适合休息。", "状态反馈应先进入环境，而不是要求用户打开应用。"],
      ["桌面任务", "长时间工作时，设备不能制造新的视觉噪声", "连续工作超过两小时后，用户只会接受低亮度、稳定位置的提醒；跳动的数字和频繁提示会被直接关闭。", "用稳定光带和静默状态替代高频数字通知。"],
      ["空间行为", "进风面被书本和织物遮挡是常见情况", "设备被放在书桌或床头后，旁边的物品会逐渐靠近进风区域，维护提醒必须能解释原因。", "把进风边界设计成可见、可擦拭的结构。"],
      ["维护记录", "滤芯更换往往不是一次完整任务", "用户通常在打扫房间时顺手处理滤芯，过于复杂的拆装路径会让维护被推迟。", "让滤芯、进风和清洁工具形成一条短路径。"],
      ["夜间体验", "有用的反馈也可能打扰入睡", "夜间进入睡眠准备后，用户更关心环境是否稳定，而不是看到更亮的提醒。", "亮度、颜色和变化速度都要有睡眠场景的边界。"],
    ],
    insights: [
      ["环境状态需要先被看见，再被解释", "低干扰状态反馈", "夜间用户先感知空间是否安静，再决定是否操作设备。", [0, 1]],
      ["长期摆放的设备要像家居物件，而不是仪器", "家居化体量", "设备越像独立仪器，越容易在不使用时被收起，反而失去连续感知价值。", [0, 1, 4]],
      ["维护边界必须在造型中被读懂", "可视维护路径", "进风和滤芯是影响真实效果的关键，却常常被家具和杂物遮挡。", [2, 3]],
      ["反馈变化速度和颜色同样重要", "夜间安静模式", "提示强度不只由亮度决定，变化速度也会影响空间是否显得焦虑。", [0, 4]],
      ["环境设备的可信度来自可重复的日常动作", "轻维护循环", "当用户能在固定位置完成擦拭、换芯与复位，数据反馈才更容易被相信。", [2, 3]],
    ],
    directions: [
      { name: "静默灯塔", subtitle: "让环境状态成为空间的一束光", formLanguage: "垂直体量、窄幅光带、矿物白壳体与低位底座", keywords: ["低干扰", "空间陪伴", "夜间"], opportunity: "把空气状态变成不打断生活的环境线索。", hypothesis: "用户会更愿意长期使用像家居摆件的设备。", tradeoff: "牺牲部分信息密度，换取更好的夜间舒适度。", validationMetric: "状态识别正确率、夜间打扰评分与连续摆放天数", cmf: "矿物白 + 雾青光带 + 暖灰底座", evidence: [0, 1, 4], insights: [0, 1, 3] },
      { name: "桌面呼吸", subtitle: "把工作节奏和空气反馈放在同一视线", formLanguage: "横向低重心、柔和顶面、侧向进风与可擦拭前框", keywords: ["桌面", "久坐", "可维护"], opportunity: "在工作视线边缘提供不抢焦点的环境反馈。", hypothesis: "当设备保持低矮和稳定，用户会把它当作桌面工作的一部分。", tradeoff: "降低存在感后，需提高边界状态的可读性。", validationMetric: "工作场景识别时延、遮挡误判率与清洁完成率", cmf: "暖白主体 + 石墨前框 + 细雾面金属", evidence: [1, 2, 3], insights: [0, 2, 4] },
      { name: "窗边气候仪", subtitle: "让自然光成为状态提示的一部分", formLanguage: "窄扁轮廓、半透扩散面、朝向窗侧的传感器区域", keywords: ["自然光", "边界", "视觉柔和"], opportunity: "借助窗边光线让空气状态更自然地被注意到。", hypothesis: "环境光参与反馈后，用户不需要持续盯着数字。", tradeoff: "需要在不同日照下保持颜色与亮度的稳定。", validationMetric: "不同光照下的判读一致性与光带舒适度", cmf: "浅灰半透面 + 云母银边框 + 苔绿状态色", evidence: [0, 2, 4], insights: [0, 1, 3] },
    ],
    concepts: [
      ["塔式静默灯", "把状态光带置于视线边缘，用垂直体量释放桌面面积。", "状态进入空间但不打断工作", "顶部光带在强光下可读性不足"],
      ["床头低位版", "降低高度并扩大底部支撑，让夜间取放和清洁更顺手。", "适合睡前和床头场景", "低位进风区容易被织物遮挡"],
      ["柔光环抱版", "让一圈连续扩散光围绕壳体，表达空气持续流动。", "视觉辨识度与情绪价值高", "光环容易被误解为装饰灯"],
      ["桌面呼吸盒", "用横向低重心体量整合前框、滤芯和状态窗。", "适合久坐与书桌工作", "横向占用面积更大"],
      ["侧向进风盒", "把进风面放在侧边，保留前方完整的工作界面。", "维护边界更容易解释", "侧向摆放需要更明确的间距"],
      ["可擦拭前框", "用可拆前框把滤芯维护和外观清洁合并成一个动作。", "维护动作短且可重复", "拆卸结构需要寿命验证"],
      ["窗边半透柱", "用半透面捕捉自然光，反馈颜色随空气状态轻微改变。", "自然融入窗边与客厅", "强日照下需要控制反射"],
      ["光影刻度版", "用细刻度表达状态区间，避免数字屏幕进入家居空间。", "状态解释更明确", "刻度需要做可读性测试"],
      ["苔绿静态版", "用一条低饱和色带表达稳定状态，强调长期陪伴。", "最克制、最不打扰", "异常状态的告警幅度需单独设计"],
    ],
    cmf: [
      ["矿物静默", "面向卧室与客厅的低对比方案，强调安静的长期摆放。", [["主体", "ABS", "矿物白", "细砂雾面", "降低仪器感并便于擦拭"], ["光带", "PC", "雾青", "半透扩散", "让状态在夜间保持柔和"]]],
      ["桌面石墨", "面向工作台面的中性方案，强调屏幕边界与维护区域。", [["主体", "PC+ABS", "暖灰", "微纹理", "减少桌面反光并隐藏细小污渍"], ["前框", "铝合金", "石墨", "细喷砂", "建立可拆前框的触觉边界"]]],
      ["窗边苔绿", "面向自然光环境的轻色方案，让反馈和室内植物保持关系。", [["主体", "ABS", "浅灰", "丝光", "平衡窗边高亮与室内阴影"], ["状态件", "PC", "苔绿", "透明染色", "把环境状态和自然语义连接起来"]]],
    ],
    versions: [
      ["V1 · 环境仪器原型", "先建立传感器、进风和状态光带的关系。", "验证光带是否能在空间中被读懂。", "从数据功能进入家居形态。"],
      ["V2 · 低干扰结构版", "降低屏幕存在感，调整进风面和滤芯前框。", "用户反馈夜间提示过于主动。", "把反馈强度转为亮度、颜色与速度的组合。"],
      ["V3 · 静默灯塔定稿", "保留窄光带和可擦拭前框，形成连续维护路径。", "概念需要进入 CMF 与耐久验证。", "将空间融入度作为最终判断指标。"],
    ],
    review: ["静默灯塔已经把环境状态从数字提醒转成空间线索。", "光带和滤芯前框均有上游研究依据。", "夜间亮度与进风区遮挡仍需在真实卧室中验证。", "建立 1:1 光学与维护样机，完成三种照度下的状态识别和 30 天清洁记录。"],
  },
  "f1000000-0000-4000-8000-000000000102": {
    slug: "journey-water-capsule",
    evidence: [
      ["出行观察", "设备从行李中取出时，用户先寻找可握位置", "高铁座位和露营桌面都缺少完整操作空间，用户会用手掌托住机身再寻找开合处。", "握持路径和展开路径必须连续，不能把用户分成两只手。"],
      ["接水任务", "瓶口与进水口的对应关系经常需要确认", "当设备折叠在包内后，用户无法快速判断接水方向，常出现先打开再旋转的无效动作。", "水路入口应在收纳和工作状态中保持可理解。"],
      ["交通场景", "移动中的饮水设备最怕晃动与残水", "列车小桌板和露营桌面都要求设备快速落脚，残余水滴会让收回动作变得谨慎。", "稳定落脚和干燥边界是便携体验的一部分。"],
      ["结构比较", "折叠铰链越多，越难解释清洁路径", "竞品通过多个折叠件缩小体积，但用户很难判断哪里会藏水、哪里可以拆洗。", "折叠结构必须服务于清洁，而不仅是收纳。"],
      ["短途复用", "用户需要在一天内多次展开和收回", "短途出行中用户不会为一次使用学习复杂步骤，第一次的展开逻辑决定是否继续携带。", "把展开、接水、饮用、收回设计成同一套节奏。"],
    ],
    insights: [
      ["便携的核心是可预测的连续动作", "单手展开路径", "用户拿起设备时就需要知道下一步在哪里发生。", [0, 4]],
      ["水路入口需要在收纳状态也保持方向感", "可读接水口", "错误的旋转和对位会直接放大移动场景的操作成本。", [1, 3]],
      ["移动后的落脚稳定性决定是否愿意复用", "落脚与防滑", "放下后还要重新扶住设备，会让便携感变成额外负担。", [2, 4]],
      ["清洁边界应当和折叠边界重合", "可拆洗折叠", "哪里能打开、哪里能擦干，应该在结构上被直接看见。", [2, 3]],
      ["短途产品要同时服务取出与收回", "一条收纳逻辑", "如果收回动作不稳定，用户会减少携带频率。", [0, 2, 4]],
    ],
    directions: [
      { name: "一折即用", subtitle: "把展开、接水与收回压缩成一条动作", formLanguage: "低矮扁平体量、单一折轴、透明水窗与大面积防滑底", keywords: ["一折", "可预测", "快收"], opportunity: "让设备从行李到工作状态只需要一次清晰展开。", hypothesis: "单一折轴会显著降低短途出行中的学习成本。", tradeoff: "结构更简单，但需要牺牲一部分收纳厚度。", validationMetric: "首次展开时间、单手完成率与收回误操作数", cmf: "雾蓝主体 + 烟熏水窗 + 防滑深灰底", evidence: [0, 1, 4], insights: [0, 1, 4] },
      { name: "瓶口即握", subtitle: "让水瓶接口成为最明确的握持和对位点", formLanguage: "竖向接口、外露锁环、圆润把手与可视水路", keywords: ["接口", "握持", "防误触"], opportunity: "利用用户熟悉的瓶口动作建立使用方向。", hypothesis: "接口与握持合并后，用户无需先找开关再找水路。", tradeoff: "外露结构更清晰，但需要更强的耐污保护。", validationMetric: "对位成功率、接水溢漏率与握持舒适度", cmf: "冷白主体 + 钴蓝锁环 + 透明浅灰水路", evidence: [0, 1, 3], insights: [1, 2, 3] },
      { name: "露营水站", subtitle: "把净水设备变成可落脚的短途补水站", formLanguage: "宽底座、展开台面、分区水槽与可见排水通道", keywords: ["露营", "稳定", "排水"], opportunity: "在有限桌面上让设备快速落脚、接水并保持干燥。", hypothesis: "稳定底座和可见排水会提高户外场景的复用意愿。", tradeoff: "工作面更完整，但收纳体积会增加。", validationMetric: "不同桌面落脚成功率、残水清理时长与重复使用率", cmf: "沙砾灰主体 + 橙色提示件 + 深蓝防滑脚", evidence: [2, 3, 4], insights: [2, 3, 4] },
    ],
    concepts: [
      ["单折水舱", "用一个横向折轴把机身和水槽折成扁平单元。", "展开路径最短", "折轴寿命压力集中"],
      ["前置水窗", "把水量和接水口放在同一前侧，减少旋转确认。", "方向关系清晰", "前侧组件更容易被碰撞"],
      ["磁吸收回", "用磁性定位让收回状态自动对齐并减少残水泄漏。", "收回反馈明确", "磁吸件耐久与异物风险待测"],
      ["瓶口握环", "把握持和接口合并成一只可旋转的圆环。", "一手对位自然", "环形结构需要防滑与耐污"],
      ["侧向锁环", "用侧向蓝色锁环表达开合边界与清洁入口。", "结构状态可读", "侧向操作需要单手可达"],
      ["透明水路", "让水路和排空路径在外壳上直接可见。", "维护边界明确", "透明材料长期耐污待证"],
      ["露营宽底", "通过大底座和分区水槽提高户外桌面稳定性。", "放下即稳", "便携厚度增加"],
      ["折叠台面", "折叠后是提箱，展开后成为临时补水台。", "场景价值完整", "展开步骤多于单折方案"],
      ["排水脚环", "底部设置可拆排水环，让残水离开主要握持区。", "干燥动作更短", "底部零件清洁需要验证"],
    ],
    cmf: [
      ["雾蓝随行", "面向高铁与城市短途的轻量方案，强调清洁和移动辨识。", [["主体", "PC+ABS", "雾蓝", "细砂雾面", "减少行李摩擦痕并保持轻量感"], ["锁环", "TPE", "钴蓝", "防滑纹理", "让展开边界在单手操作时清晰可触"]]],
      ["水路可见", "面向需要快速判断水量和清洁边界的用户。", [["主体", "ABS", "冷白", "半哑光", "建立饮水设备的清洁预期"], ["水窗", "PC", "浅灰透明", "硬化涂层", "让残水与水量可以被看见"]]],
      ["露营耐用", "面向户外桌面的耐污、耐磨和稳定方案。", [["主体", "PC+ABS", "沙砾灰", "粗纹理", "降低户外刮擦与污渍显现"], ["底座", "TPE", "深蓝", "高摩擦", "提高不同桌面上的落脚稳定性"]]],
    ],
    versions: [
      ["V1 · 折叠水具原型", "先建立水路、铰链和行李收纳的基本关系。", "验证折叠是否真的减少携带负担。", "从移动任务切入结构设计。"],
      ["V2 · 单手展开版", "减少旋转确认，增加锁环与可视水窗。", "短途用户在第一次使用时找不到接水方向。", "将方向感前置到结构和颜色。"],
      ["V3 · 一折即用定稿", "把展开、接水、落脚和排水整理成连续路径。", "进入铰链、密封和耐污验证。", "把重复使用率作为便携体验的结果指标。"],
    ],
    review: ["一折即用把收纳和工作状态放在同一条操作路径上。", "折轴、锁环和水窗都能追溯到出行观察。", "密封寿命与残水排空仍可能影响高频复用。", "完成 1:1 铰链样机、500 次开合和三种桌面防滑测试，再决定是否进入量产结构。"],
  },
  "f1000000-0000-4000-8000-000000000103": {
    slug: "kitchen-loop-reclaimer",
    evidence: [
      ["饭后观察", "用户愿意投放，但不愿意多记一个复杂步骤", "晚餐结束后的动作已经很多，任何需要额外分类、确认或等待的步骤都会被推迟。", "投放边界和启动反馈必须在一次顺手动作中完成。"],
      ["气味反馈", "湿垃圾的气味是停止使用的第一原因", "用户往往先处理气味，再关注减量结果；封闭状态如果让人不放心，设备会被移出厨房。", "密封与状态反馈要建立可持续的可信感。"],
      ["清洁任务", "抽屉取出时，手会避开最容易沾污的位置", "用户会用纸巾、手套或临时工具抓取抽屉边缘，说明握持和内胆边界没有被设计清楚。", "取出、倒空和擦拭应当共享一个干净握持区。"],
      ["声音观察", "厨房设备的噪声会被误解成故障", "夜间运行时，持续嗡鸣会让用户提前停止程序，即使处理结果还没有完成。", "运行状态需要分层反馈，而不是持续制造声音。"],
      ["空间观察", "垃圾桶形态会降低家庭成员的长期使用意愿", "当设备看起来像临时容器，家人会把它当成额外清洁负担，而不是厨房流程的一部分。", "形态、材质和开口都要表达厨房设备身份。"],
    ],
    insights: [
      ["环保动作必须嵌入饭后原有节奏", "顺手投放", "减少一次确认就等于减少一次放弃的机会。", [0, 4]],
      ["气味控制是家庭信任的前置条件", "密封可解释", "用户需要知道设备如何封闭、何时换气、何时需要清洁。", [1, 3]],
      ["干净握持区决定维护是否可持续", "抽屉洁净路径", "取出动作越接近污染区，清洁越容易被推迟。", [2, 4]],
      ["安静不等于没有状态反馈", "分层运行提示", "用户需要知道设备在工作，但不应该用持续噪声证明它在工作。", [1, 3]],
      ["产品身份会影响全家共同使用", "厨房设备化", "当外观和操作更接近厨房设备，环保任务才更容易被纳入日常。", [0, 4]],
    ],
    directions: [
      { name: "温暖循环", subtitle: "让餐后处理成为厨房里的一段节奏", formLanguage: "矮圆柱体、陶土橙前环、前置抽屉与柔和状态点", keywords: ["家庭融入", "易清洁", "低噪"], opportunity: "让投放、处理和取出变成一条不增加负担的饭后路径。", hypothesis: "更像厨房设备而不是垃圾容器，会提高长期使用率。", tradeoff: "保留生活感，同时必须让清洁边界足够可读。", validationMetric: "饭后投放完成率、误触率与清洁后异味反馈", cmf: "陶土橙 + 炭黑底环 + 暖白提示", evidence: [0, 1, 4], insights: [0, 1, 4] },
      { name: "静音抽屉", subtitle: "用清晰的抽屉路径替代复杂的运行提示", formLanguage: "横向低位、软包边缘、隐藏排气口与大面积洁净把手", keywords: ["静音", "取出", "密封"], opportunity: "把维护动作从脏乱的容器体验转成明确的抽屉体验。", hypothesis: "用户能在不接触污染区的情况下完成倒空和擦拭。", tradeoff: "抽屉和密封结构更完整，但体积会变大。", validationMetric: "取出完成时间、手部接触污染区次数与噪声接受度", cmf: "奶油白主体 + 松针绿把手 + 深灰密封圈", evidence: [1, 2, 3], insights: [1, 2, 3] },
      { name: "模块循环", subtitle: "让容器、滤芯和干燥模块各自被维护", formLanguage: "上下模块、可拆内胆、环形底座与颜色分区", keywords: ["模块", "维护", "循环"], opportunity: "把不同维护频率的部件拆成可以理解的独立层级。", hypothesis: "模块化维护会减少用户对整机清洁的心理负担。", tradeoff: "可维护性更强，但首次学习成本会上升。", validationMetric: "模块拆装时长、部件误装率与维护周期完成率", cmf: "温灰壳体 + 叶绿内胆 + 暗橙定位件", evidence: [1, 2, 4], insights: [1, 2, 4] },
    ],
    concepts: [
      ["饭后圆环", "用环形开口引导投放，让厨余从台面自然进入内胆。", "投放动作最顺手", "环形开口容易积污"],
      ["前置洁净把手", "把取出把手放在远离污染区的前框位置。", "清洁路径可解释", "前框结构需要防夹手"],
      ["暖光状态点", "用一个低亮度点表达处理中、完成和需要清洁。", "运行反馈不扰人", "异常状态需有更高对比"],
      ["静音滑抽", "用阻尼滑轨让内胆平稳出入，减少碰撞噪声。", "维护动作有安全感", "滑轨耐污寿命待证"],
      ["密封前舱", "把排气与密封集中在前舱，减少气味扩散路径。", "气味边界清晰", "前舱需要易拆洗"],
      ["软触抽屉", "以软触边缘和大面积握持区降低接触污染的焦虑。", "取出更愿意被重复", "软触材料耐污性待验证"],
      ["三层循环", "上层投放、中层干燥、下层可拆储存，分别对应维护频率。", "结构语义强", "模块高度受厨房空间限制"],
      ["可换内胆", "让最脏的部分独立成为可替换、可清洁的组件。", "延长整机使用周期", "内胆成本和密封要平衡"],
      ["颜色定位环", "用暗橙、叶绿和深灰标识部件的拆装关系。", "模块状态一眼可见", "颜色系统需控制视觉喧闹"],
    ],
    cmf: [
      ["温暖厨房", "面向家庭厨房的低压力方案，强调生活感与可擦拭表面。", [["主体", "ABS", "奶油白", "细砂雾面", "降低垃圾容器感并方便擦拭"], ["前环", "TPE", "陶土橙", "柔触纹理", "让投放边界更有温度"]]],
      ["静音深绿", "面向高频维护的中性方案，突出洁净把手和密封边界。", [["主体", "PC+ABS", "温灰", "微纹理", "隐藏厨房油污和日常擦痕"], ["把手", "TPE", "松针绿", "软触", "提供远离污染区的稳定握持"]]],
      ["循环分层", "面向模块维护的识别方案，用颜色建立部件之间的关系。", [["外壳", "ABS", "温灰", "哑光", "保持整机和厨房环境的协调"], ["内胆", "PP", "叶绿", "易清洁", "表达可拆洗和循环使用的部件身份"]]],
    ],
    versions: [
      ["V1 · 厨余容器原型", "先建立投放口、内胆和底座的基本关系。", "验证用户是否愿意把饭后动作放进设备。", "从环保意图进入厨房任务。"],
      ["V2 · 静音抽屉版", "重做抽屉、密封和洁净把手，降低维护阻力。", "用户把气味和取出脏手视为主要风险。", "把维护体验提升到和投放同等重要。"],
      ["V3 · 温暖循环定稿", "用颜色分区和低亮状态点表达循环状态。", "进入耐污、噪声和模块寿命验证。", "把长期复用率作为环保价值的结果指标。"],
    ],
    review: ["温暖循环把厨余处理嵌入厨房已有的饭后节奏。", "投放口、洁净把手和低亮状态点都有观察依据。", "气味密封、抽屉寿命和高频清洁仍需实测。", "制作 1:1 抽屉与密封样机，完成噪声、残留气味和 30 次连续清洁测试。"],
  },
  "f1000000-0000-4000-8000-000000000104": {
    slug: "granary-fresh-rail",
    evidence: [
      ["补货访谈", "用户知道家里有东西，但常常不知道还剩多少", "干货和调味品被放在柜子深处后，重复购买和临期浪费会一起发生。", "存量可见比增加提醒更能改变补货判断。"],
      ["烹饪观察", "取用路径被多个瓶罐打断", "用户在烹饪时会连续取出几种材料，深柜和叠放会造成寻找、搬移和暂放。", "模块应该围绕高频取用顺序组织，而不是只追求容量。"],
      ["清洁任务", "最常被清洁的是单个模块，而不是整面墙", "溢出的米粒、油渍和粉末通常只影响一两个容器，整组拆下会增加维护成本。", "每个模块都要有独立拆洗的握持和边界。"],
      ["安装限制", "墙面承重和安装高度会决定是否敢于扩展", "合租和小户型用户希望可以迁移或增减模块，不接受一次性打孔后无法调整的系统。", "安装轨道需要让增减和承重关系被理解。"],
      ["透明材料", "看得见不等于看起来有秩序", "透明件如果没有明确分区，物品、标签和反光会让墙面变得杂乱。", "透明、标签和颜色必须共同建立视觉秩序。"],
    ],
    insights: [
      ["可见库存应该发生在取用路径上", "一眼补货", "用户不需要进入另一个工具就能判断是否需要补充。", [0, 1]],
      ["模块化价值来自局部维护而不是无限拼接", "单模块清洁", "一个部件脏了不应该牵动整组收纳。", [2, 4]],
      ["安装关系决定系统能不能继续扩展", "可迁移轨道", "如果添加和移动都需要重新施工，模块化就失去价值。", [3, 1]],
      ["透明件需要被颜色和标签约束", "有秩序的透明", "可见内容越多，越需要稳定的分区和状态标记。", [0, 4]],
      ["厨房收纳要把高频取用放在最顺手的位置", "取用优先级", "容量不是第一指标，连续取用时的移动次数才是。", [1, 2]],
    ],
    directions: [
      { name: "可见轨道", subtitle: "让库存、取用与扩展共享一条墙面秩序", formLanguage: "横向圆角模块、烟熏透明仓、铝合金轨道与琥珀分区", keywords: ["可见库存", "可扩展", "拆洗"], opportunity: "让取用、补充和清洁围绕同一组模块完成。", hypothesis: "当库存自然展示，用户不需要额外打开应用确认。", tradeoff: "透明度带来可见性，也带来材料耐久与视觉秩序要求。", validationMetric: "取用时间、补货识别率与模块拆洗完成率", cmf: "烟熏透明 + 铝银轨道 + 琥珀提示", evidence: [0, 3, 4], insights: [0, 2, 3] },
      { name: "抽拉鲜度", subtitle: "用抽拉动作把高频取用和状态查看合并", formLanguage: "纵向抽屉、半透前板、圆角导轨与暖色存量刻度", keywords: ["抽拉", "高频", "状态"], opportunity: "让用户在拿取时同时完成库存和新鲜度判断。", hypothesis: "前板、刻度和抽拉阻尼会降低深柜寻找成本。", tradeoff: "体验更像家具，但结构和导轨成本更高。", validationMetric: "连续取用步数、存量误判率与抽拉耐久次数", cmf: "奶油灰前板 + 雾棕透明 + 暖黄刻度", evidence: [0, 1, 2], insights: [0, 1, 4] },
      { name: "台面桥接", subtitle: "把墙面储存和烹饪台面连接成连续的取用面", formLanguage: "低位横梁、可移底座、开放托盘与局部透明仓", keywords: ["台面", "桥接", "顺手"], opportunity: "在不增加深柜搜索的情况下，把常用材料放到动作前方。", hypothesis: "墙面与台面之间的桥接位置能减少连续烹饪中的移动。", tradeoff: "取用更快，但台面占用和清洁边界需要控制。", validationMetric: "连续取用移动次数、台面占用面积与清洁时间", cmf: "浅沙灰 + 透明暖白 + 深棕防滑垫", evidence: [1, 2, 3], insights: [1, 2, 4] },
    ],
    concepts: [
      ["轨道透明仓", "用一条连续轨道承载不同宽度的透明储存模块。", "扩展关系最清晰", "透明件反光会干扰标签"],
      ["琥珀存量条", "用侧边色带表达低库存和补货边界。", "补货信息一眼可见", "不同材料颜色一致性待测"],
      ["单仓拆洗", "每个透明仓独立脱离轨道并保持满手握持。", "维护影响范围最小", "拆装动作需要防掉落"],
      ["高频抽屉", "把常用调味品放在阻尼抽拉的前板内。", "连续烹饪更顺手", "导轨占用深度增加"],
      ["雾面前板", "用半透雾面遮住杂乱，只保留存量轮廓和标签。", "视觉秩序更稳定", "存量判读需要更多刻度"],
      ["旋钮定位", "用小旋钮锁定抽屉状态和清洁边界。", "交互与结构统一", "旋钮有积尘风险"],
      ["台面桥", "用低位横梁把墙面模块延伸到烹饪动作前方。", "减少取用移动", "台面清洁边界待验证"],
      ["开放托盘", "将当日高频材料放到可快速取放的开放托盘中。", "使用节奏更快", "开放区容易积灰"],
      ["可移底座", "用可滑移底座兼容租住空间和不同台面。", "迁移与重组成本低", "底座承重需要测试"],
    ],
    cmf: [
      ["有秩序的透明", "面向墙面展示和补货判断的方案，强调透明、标签和轨道关系。", [["储存仓", "PC", "烟熏透明", "硬化雾面", "减少反光并保持内容轮廓"], ["轨道", "铝合金", "银灰", "阳极氧化", "表达可扩展和可迁移结构"]]],
      ["温和抽拉", "面向高频烹饪的家具化方案，强调触感和前板秩序。", [["前板", "ABS", "奶油灰", "细砂", "让标签和存量成为主要信息"], ["刻度", "PC", "暖黄", "半透", "在取用时提供轻量补货提示"]]],
      ["台面桥接", "面向租住和小户型厨房的轻量方案，减少视觉和安装压力。", [["模块", "PP", "浅沙灰", "微纹理", "耐油污并便于单模块拆洗"], ["底座", "TPE", "深棕", "防滑纹理", "稳定桥接台面并隐藏接触污渍"]]],
    ],
    versions: [
      ["V1 · 墙面收纳原型", "先建立轨道、透明仓和标签位置的基本关系。", "验证可见库存是否真的改变补货判断。", "从容量逻辑进入取用路径。"],
      ["V2 · 单模块维护版", "增加独立拆洗边界，调整透明度和模块间距。", "用户担心透明件显乱、清洁牵动整组。", "让局部维护成为模块化的核心价值。"],
      ["V3 · 可见轨道定稿", "用轨道、色带和低位桥接区连接库存与烹饪动作。", "进入承重、日照和高频拆洗验证。", "把取用时间和重复购买率作为系统结果指标。"],
    ],
    review: ["可见轨道把库存判断、取用和模块维护串成一套厨房秩序。", "透明仓、轨道和单模块拆洗都有来自访谈与观察的依据。", "墙面承重、长期日照和透明件清洁仍需实测。", "完成 1:1 轨道承重、透明材料耐黄变和 100 次模块拆洗测试，再决定安装结构。"],
  },
};

function makeEvidence(item, spec) {
  return spec.evidence.map(([type, title, excerpt, meaning], index) => ({
    id: idFor(item.id, 501 + index), sourceId: `${idFor(item.id, 501 + index)}-source`, projectId: item.id,
    type, source: `${item.name} · ${type}记录`, sourceTitle: `${item.name} · ${type}记录`, sourceType: "user_paste",
    credibility: index % 2 ? "待验证" : "设计师已确认", title, excerpt, fact: excerpt, meaning,
    museInterpretation: meaning, designImplication: meaning, limitation: "项目研究种子，需用真实用户研究补充。",
    status: "accepted", accepted: true, contentOrigin: "demo_seed",
    image: imagePath(spec.slug, "evidence", index + 1),
  }));
}

function makeInsights(item, spec, evidence) {
  return spec.insights.map(([statement, opportunity, rationale, sourceIndexes], index) => ({
    id: idFor(item.id, 601 + index), projectId: item.id, sourceEvidenceIds: sourceIndexes.map((sourceIndex) => evidence[sourceIndex].id),
    evidenceIds: sourceIndexes.map((sourceIndex) => evidence[sourceIndex].id), statement, opportunity, rationale,
    status: "confirmed", confirmed: true, contentOrigin: "demo_seed",
    image: imagePath(spec.slug, "insight", index + 1),
  }));
}

function makeDirections(item, spec, evidence, insights) {
  return spec.directions.map((direction, index) => ({
    id: idFor(item.id, 701 + index), code: String.fromCharCode(65 + index), name: direction.name, subtitle: direction.subtitle, contentOrigin: "demo_seed",
    image: imagePath(spec.slug, "direction", index + 1), formLanguage: direction.formLanguage, keywords: direction.keywords, cmf: direction.cmf,
    evidenceIds: direction.evidence.map((sourceIndex) => evidence[sourceIndex].id), insightIds: direction.insights.map((insightIndex) => insights[insightIndex].id),
    opportunity: direction.opportunity, risk: `需要验证${direction.validationMetric}，避免${direction.tradeoff}`, hypothesis: direction.hypothesis, tradeoff: direction.tradeoff, validationMetric: direction.validationMetric,
    metrics: { userFit: 4 + (index % 2), portability: 3 + index, emotion: 4 - (index % 2), complexity: 3 + index, evidence: 5 },
  }));
}

function makeConcepts(item, spec, directions) {
  return spec.concepts.map(([title, intent, strength, risk], index) => {
    const direction = directions[Math.floor(index / 3)];
    return {
      id: idFor(item.id, 801 + index),
      directionId: direction.id,
      code: String.fromCharCode(65 + (index % 3)),
      name: title,
      image: imagePath(spec.slug, "concept", index + 1),
      imageSource: "demo-asset",
      visualMode: "demo-asset",
      contentOrigin: "demo_seed",
      conceptStatement: intent,
      coreMechanism: intent,
      userExperience: intent,
      whyFitsDirection: intent,
      productExpression: intent,
      evidenceIds: direction.evidenceIds,
      insightIds: direction.insightIds,
      advantages: [strength],
      risks: [risk],
      validationQuestions: [`如何验证“${title}”在${direction.name}方向下的核心机制？`],
      metrics: { portability: 3 + (index % 3), capacity: 4, userFit: 4, usability: 4 + (index % 2), complexity: 3 + (index % 3), identity: 4 },
      status: "candidate",
    };
  });
}

function makeCMF(item, spec) {
  return spec.cmf.map(([name, summary, parts], index) => ({
    id: idFor(item.id, 901 + index), code: String.fromCharCode(65 + index), name, image: imagePath(spec.slug, "cmf", index + 1), imageSource: "demo-asset", visualMode: "demo-asset", contentOrigin: "demo_seed", crop: index, summary,
    parts: parts.map(([part, material, color, finish, rationale], partIndex) => ({ part, material, color, finish, rationale, validationState: partIndex ? "AI 建议，待人工确认" : "待验证" })),
  }));
}

function makeVersions(item, spec) {
  return spec.versions.map(([label, whatChanged, reviewTrigger, why], index) => ({
    id: idFor(item.id, 1001 + index),
    number: index + 1,
    parentVersionId: index ? idFor(item.id, 1001 + index - 1) : null,
    label,
    image: imagePath(spec.slug, "version", index + 1),
    whatChanged,
    changeSummary: whatChanged,
    why,
    reviewTrigger,
    retained: ["已确认的上游研究、方向规则与产品身份"],
    nextValidation: [reviewTrigger],
    contentOrigin: "demo_seed",
  }));
}

function makeReview(item, spec, direction, concept, cmf) {
  const id = `review-${spec.slug}`;
  return { id, createdAt: timestamp, mode: "portfolio-seed", context: { directionId: direction.id, direction: `${direction.code} · ${direction.name}`, conceptId: concept.id, concept: `${concept.code} · ${concept.name}`, cmfId: cmf.id, cmf: `${cmf.code} · ${cmf.name}` }, summary: spec.review[0], strengths: [{ title: "决策链完整", evidence: spec.review[1] }, { title: "下一步清晰", evidence: "当前方案已经把研究观察转成结构、材料与验证动作。" }], issues: [{ id: `${id}-engineering`, severity: "high", title: "关键结构仍缺少工程验证", evidence: concept.risks?.join("；"), impact: spec.review[2], recommendation: spec.review[3], validationState: "TO_BE_VALIDATED" }, { id: `${id}-material`, severity: "medium", title: "材料耐久与高频清洁未证实", evidence: cmf.parts.map((part) => `${part.part}: ${part.material}/${part.finish}`).join("；"), impact: "表面变化会削弱长期使用的可信感。", recommendation: "完成耐污、擦拭与寿命对比，并保留可回溯的照片记录。", validationState: "AI_RECOMMENDATION" }] };
}

export function createPortfolioIndustrialState(item, index) {
  const spec = projectSpecs[item.id];
  if (!spec) throw new Error(`PORTFOLIO_SPEC_NOT_FOUND:${item.id}`);
  const evidence = makeEvidence(item, spec);
  const insights = makeInsights(item, spec, evidence);
  const directions = makeDirections(item, spec, evidence, insights);
  const conceptCandidates = makeConcepts(item, spec, directions);
  const cmfSchemes = makeCMF(item, spec);
  const versionStory = makeVersions(item, spec);
  const review = makeReview(item, spec, directions[0], conceptCandidates[0], cmfSchemes[0]);
  const selectedInsightIds = insights.slice(0, 3).map((item) => item.id);
  const state = {
    schemaVersion: 8,
    prototypeMode: "portfolio-seed",
    demoPortfolioReady: true,
    visualMode: "demo-asset",
    currentStage: "review",
    briefConfirmed: true,
    selectedEvidenceIds: evidence.map((item) => item.id),
    selectedInsightIds,
    selectedDirectionId: directions[0].id,
    directionLocked: true,
    selectedConceptId: conceptCandidates[0].id,
    selectedCMFId: cmfSchemes[0].id,
    currentReviewId: review.id,
    currentVersionId: versionStory.at(-1).id,
    completedStages: ["brief", "research", "insight", "direction", "concept", "cmf", "review", "versions", "decision-map"],
    decisions: [
      { id: `${item.id}-brief`, type: "BRIEF_CONFIRMED", label: "已确认产品设计 Brief", at: timestamp },
      { id: `${item.id}-insight`, type: "INSIGHTS_CONFIRMED", label: `确认 ${selectedInsightIds.length} 条设计洞察`, at: timestamp },
      { id: `${item.id}-direction`, type: "DIRECTION_LOCKED", label: `锁定方向 ${directions[0].code} · ${directions[0].name}`, at: timestamp },
      { id: `${item.id}-concept`, type: "CONCEPT_SELECTED", label: `选择概念 ${conceptCandidates[0].code} · ${conceptCandidates[0].name}`, at: timestamp },
      { id: `${item.id}-cmf`, type: "CMF_SELECTED", label: `选择 CMF ${cmfSchemes[0].code} · ${cmfSchemes[0].name}`, at: timestamp },
      { id: `${item.id}-review`, type: "REVIEW_CREATED", label: "完成证据化设计评审", at: timestamp },
    ],
    brief: item.brief,
    evidence,
    insights,
    directions,
    conceptCandidates,
    cmfSchemes: cmfSchemes.map((item) => ({ ...item, conceptId: conceptCandidates[0].id })),
    reviews: [review],
    versionStory,
  };
  const industrial = {
    ...state,
    demoVisuals: createDemoVisualsFromIndustrial({ projectId: item.id, industrial: state }),
  };
  industrial.selectedVisualId = industrial.demoVisuals.find((visual) => visual.stage === "concept" && visual.conceptId === industrial.selectedConceptId)?.id ?? industrial.demoVisuals[0]?.id ?? null;
  return industrial;
}

function assetRecord(item, url, role, name, tags, index) {
  return { id: `${item.id}-${role}-${String(index).padStart(2, "0")}`, projectId: item.id, name, type: "image", status: "ready", mimeType: "image/svg+xml", byteSize: 180_000, storageKey: url.replace(/^\/assets\//, ""), url, width: 1536, height: 1024, role, source: `${item.name} · 语义化工作流素材`, license: "Muse prototype asset · generated for this project", tags: [item.category, "工业设计", ...tags], colors: ["#DDEBE2", "#8CB7B0", "#263A3C"], favorite: false, createdAt: timestamp, updatedAt: timestamp };
}

const legacyAssetRecord = assetRecord;
assetRecord = (...args) => ({ ...legacyAssetRecord(...args), mimeType: "image/png", byteSize: 95_000, width: 298, height: 298 });

export function createPortfolioWorkflowAssets(item, index) {
  const industrial = createPortfolioIndustrialState(item, index);
  const assets = [assetRecord(item, item.image, "cover", `${item.name} · 项目封面`, ["项目概览"], 0)];
  const groups = [
    [industrial.evidence, "evidence", "研究证据", "研究"],
    [industrial.insights, "insight", "设计洞察", "洞察"],
    [industrial.directions, "direction", "设计方向", "方向"],
    [industrial.conceptCandidates, "concept", "产品概念", "概念"],
    [industrial.cmfSchemes, "cmf", "材料与色彩", "CMF"],
    [industrial.versionStory, "version", "版本记录", "版本"],
  ];
  for (const [items, group, role, tag] of groups) items.forEach((record, itemIndex) => assets.push(assetRecord(item, record.image, group, `${item.name} · ${role} · ${record.name || record.label}`, [tag], itemIndex + 1)));
  return assets;
}

export function getIndustrialPortfolioSpec(projectId) {
  return projectSpecs[projectId] ?? null;
}
