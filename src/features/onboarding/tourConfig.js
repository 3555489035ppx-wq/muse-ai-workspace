export const onboardingSteps = [
  { key: "home", target: "[data-tour='home']", title: "这里是你的产品设计工作台", content: "集中查看项目、模板和当前设计阶段；从一个真实的产品问题开始。" },
  { key: "create", target: "[data-tour='create']", title: "创建项目，也可以接入 API", content: "输入命题、用户与交付物；真实 API 可选，未配置时也能用本地离线流程完成体验。" },
  { key: "brief", target: "[data-tour='brief']", title: "确认设计简报", content: "校准目标、限制和风险；确认后的信息会成为后续研究与判断的依据。" },
  { key: "research", target: "[data-tour='research']", title: "收集研究证据", content: "把用户、场景、结构和材料相关的来源与笔记放在同一处，让方向有据可循。" },
  { key: "moodboard", target: "[data-tour='moodboard']", title: "整理参考与 CMF 线索", content: "归纳材质、色彩、形态和图像语言，为产品概念建立可追溯的参考。" },
  { key: "direction", target: "[data-tour='direction']", title: "比较设计方向", content: "并排判断多个方向；保留、融合或拒绝始终由你决定。" },
  { key: "critique", target: "[data-tour='critique']", title: "评审并推进下一轮", content: "记录依据、风险和你的取舍，让每一次迭代都能解释下一步为什么改变。" },
];

export const TOUR_STORAGE_KEY = "muse:onboarding:completed:v1";
