/*
 * Local, deterministic interpretation rules for the OEJTS 1.2 result page.
 * These texts are explanatory prompts, not a diagnosis, a probability, or a
 * validated type description.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MBTIInterpretation = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function freezeDeep(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.getOwnPropertyNames(value).forEach(function (key) { freezeDeep(value[key]); });
      Object.freeze(value);
    }
    return value;
  }

  function texts(clause, expression, upside, watch, scenes) {
    return {
      clause: clause,
      expression: expression,
      upside: upside,
      watch: watch,
      scenes: scenes || {}
    };
  }

  var DIMENSIONS = {
    IE: {
      name: "与外界的互动", topic: "能量来源",
      low: "I", high: "E", lowLabel: "内向", highLabel: "外向",
      texts: {
        low: texts(
          "更习惯先在自己的节奏里整理想法，再决定要不要说出口",
          "在这份回答里，你往往先观察和倾听，等思路成形后再表达。人数较多的场合，你可能需要一点时间才能进入状态；熟悉的小圈子或一对一会让你更放松。",
          "这样的节奏适合需要专注、准备和独立判断的任务。你可以把重要想法先写下来，再选择合适的人与时机说明；提前留出独处时间，也更容易把精力用在真正在意的事上。",
          "长时间高强度的交往后，你可能比旁人更快耗尽精力，却未必及时说出来。如果发现自己开始敷衍回应或回避联系，可以明确告诉对方你需要休息，并约定稍后再聊。",
          {
            relationship: "联系不必靠频率证明。你可以说明自己回复慢不等于不在意，并约定一个双方都能接受的沟通方式；想关心别人时，用一条具体的消息或一次安静的陪伴，往往比勉强热闹更自然。",
            recovery: "恢复时先减少输入：散步、整理房间、读一点东西，或只是安静坐一会儿。给自己设一个可结束的独处时段，比无限期消失更容易回到关系里；如果独处过久开始低落，主动约一个信任的人做低强度的事。"
          }
        ),
        high: texts(
          "更容易在与人交谈和共同活动中理清思路",
          "在这份回答里，你往往通过说话、提问和互动推进思考。长时间独自工作后，可能觉得动力下降；有人一起讨论，想法会更快成形。热闹的场合通常让你进入状态，而不是消耗你。",
          "这样的偏好适合需要协调、反馈和快速试错的情境。你可以把讨论当作整理思路的方式，同时把结论写下来，避免说完就散；重要决定前，刻意留一段不被打断的独立思考。",
          "互动多的时候，你可能答应得太快，或被别人的节奏带着走。如果一天排满会议和消息，容易没有时间沉淀；可以给重要的事留出无社交的时间块，并减少同时开启的话题。",
          {
            relationship: "你更容易在交流中表达关心，但对方未必需要同样多的互动。可以先问一句对方现在想要陪伴、倾听还是建议，再决定说多少；也留意自己是否用热闹掩盖了真正想说的内容。",
            recovery: "过度社交后的疲惫常被误认成“不够积极”。恢复时可以暂时关掉消息提醒，做一件不需要回应别人的事；如果独处让你烦躁，选择低强度的共同活动，比如一起散步或做饭，而不是再开一场热闹聚会。"
          }
        ),
        balanced: texts(
          "会根据场合和当天状态，在独处与交往之间切换",
          "在这份回答里，独处和交往都可能给你能量，比例取决于事情和状态。你也许在熟悉的场合很主动，在陌生场合先观察；或在一段时间的社交后，明显需要安静。",
          "这种切换让你有机会选择更适合当下的方式。可以留意哪些活动结束后你更有精力，哪些只是当时热闹；把重要社交和重要独处都提前留出来，比平均分配更实用。",
          "两边都保留也意味着边界容易模糊：可能答应了过多邀约，也可能用独处躲开必要的沟通。当你感到疲惫或烦躁时，先判断缺的是休息还是连接，再决定下一步。",
          {
            relationship: "你可以直接说明自己的状态，例如“今天想安静，但愿意听你说十分钟”。具体说明比临时取消更少误解；也留意对方需要的互动量是否与你不同，找一个双方都能维持的频率。",
            recovery: "恢复方式可以按当天缺口选择：缺安静就减少输入，缺连接就找一个低负担的人聊几句。避免把“需要独处”当成固定借口，也避免把“需要别人”当成软弱；两种需要都可以被说明。"
          }
        )
      }
    },
    SN: {
      name: "关注信息的方式", topic: "信息取向",
      low: "S", high: "N", lowLabel: "实感", highLabel: "直觉",
      texts: {
        low: texts(
          "先从具体事实、细节和已有经验入手",
          "在这份回答里，你往往先注意发生了什么、别人具体说了什么，再考虑背后的含义。面对新任务时，你更容易从步骤、样例和可操作的信息开始，而不是先讨论抽象方向。",
          "这种取向适合需要准确执行、核对细节和积累经验的工作。你可以先把事实列清楚，再问这些事实指向什么；在团队里，你提供具体例子和现实约束，能帮讨论落回可执行的地面。",
          "如果只停在眼前信息，可能错过模式变化或更省力的做法。当你发现自己在重复熟悉流程、对新方案本能怀疑时，可以刻意问一句：这些细节合起来说明了什么？有没有另一种解释？",
          {
            work: "接手新任务时，先找一份真实样例或已完成的作品，按步骤走一遍，再归纳规律。学习抽象概念时，为每个概念配一个具体例子；如果讨论一直停在原则层面，主动请对方给一个可操作的场景。"
          }
        ),
        high: texts(
          "先留意可能性、整体联系和背后的模式",
          "在这份回答里，你往往先捕捉方向、关联和“这可能意味着什么”。面对新任务时，你容易先设想整体框架和多种路径，再回头补齐具体步骤；重复的细节工作可能让你失去耐心。",
          "这种取向适合需要提出新角度、连接信息和规划方向的情境。你可以先画出整体结构，再为关键假设找证据；在团队里，你帮助大家看到选项和长期影响，但需要把想法落到下一步。",
          "想法多于落地时，容易高估计划的清晰度，或忽略别人需要的具体信息。如果你发现自己频繁更换方向、对细节不耐烦，可以选一个最小步骤先做完，再决定是否调整。",
          {
            work: "开始新任务前，先用几句话写下目标、关键假设和一个最小可执行步骤。每展开一个新方向，就补一条现实约束或验证方式；和偏具体的人合作时，请对方帮你检查遗漏的细节和资源。"
          }
        ),
        balanced: texts(
          "会在具体细节和整体方向之间来回对照",
          "在这份回答里，你既不只依赖事实，也不只依赖直觉。你可能先看整体，再回到细节核对；也可能从具体经验出发，逐渐总结出模式。选择哪一边，常取决于任务是否熟悉。",
          "这种来回对照适合复杂、信息不完整的问题。你可以先用具体例子检验整体判断，再用整体框架筛选细节；当讨论卡住时，你往往能指出双方各自忽略的部分。",
          "两边都能用时，也可能在关键时刻迟迟不决，或在不同场合给出不一致的判断。给自己一个明确的决策标准和时间点，能减少反复；重要判断后，记录依据，便于之后复盘。",
          {
            work: "遇到新任务，先花十分钟列出已知事实，再写一版整体假设；随后用一个小实验或样例检验它。若仍犹豫，设一个截止时间，按目前证据先做可逆的选择，再根据结果修正。"
          }
        )
      }
    },
    FT: {
      name: "判断时的侧重", topic: "判断依据",
      low: "F", high: "T", lowLabel: "情感", highLabel: "思考",
      texts: {
        low: texts(
          "先考虑人的感受、关系和处境",
          "在这份回答里，你往往先注意决定会怎样影响具体的人，再考虑规则是否一致。别人向你倾诉时，你更容易先回应情绪；评价一件事时，你会把动机和处境放进判断。",
          "这种取向适合需要照顾关系、理解他人和维持合作的情境。你可以先确认对方的感受，再一起看事实和选项；在团队里，你常能发现被忽略的人际成本，但要避免把所有责任都揽到自己身上。",
          "过度顾及感受时，可能推迟必要的决定，或把别人的情绪当成自己的责任。如果你发现自己在反复解释、难以拒绝，可以先问：这件事的原则底线是什么？我能承担到哪一步？",
          {
            relationship: "冲突时，先承认对方的感受，再说明自己的立场，通常比立刻讲道理更容易被听见。你可以用“我听到你……”开头，随后说“我需要……”；如果情绪太强，约定稍后继续，而不是勉强当场解决。"
          }
        ),
        high: texts(
          "先看逻辑、一致性和可检验的标准",
          "在这份回答里，你往往先分析原因、比较方案，再处理情绪反应。别人向你倾诉时，你可能自然地给出建议；面对争议，你更在意标准是否一致、结论是否站得住。",
          "这种取向适合需要澄清问题、比较证据和做出可解释决定的情境。你可以把判断依据写清楚，方便别人检验；在团队里，你帮助讨论回到事实和取舍，但要说明结论背后的关心。",
          "只讲道理时，容易让对方觉得被否定，也可能低估自己和他人的情绪负荷。如果你发现对话变成辩论、对方不再回应，可以先停下来确认感受，再决定是否继续分析。",
          {
            relationship: "对方倾诉时，先问“你想让我听，还是一起想办法？”再决定是否给建议。表达关心时，把“我在意你”直接说出来，不要只留下一套解决方案；发生冲突时，先确认事实，再讨论谁对谁错。"
          }
        ),
        balanced: texts(
          "会同时权衡感受与原则，比例随事情而定",
          "在这份回答里，你不会固定先看感受或先看逻辑，而会根据事情调整。熟悉的人面前，你可能更照顾情绪；工作或原则问题上，你又可能更强调标准。两种理由经常同时出现。",
          "这种权衡适合需要兼顾多方立场的情境。你可以把“事实是什么”“每个人受到什么影响”“我的底线是什么”分开写，再综合判断；这样既不容易忽略人，也不容易失去标准。",
          "同时考虑太多时，可能迟迟无法表态，或在压力下突然倒向一边。给自己一个判断顺序：先确认事实，再确认影响，最后看底线；如果仍难决定，说明你还需要哪一项信息。",
          {
            relationship: "冲突时，先分别写下事实、双方感受和自己的底线，再选择先谈哪一层。你可以承认“两边都有道理”，同时给出自己的决定；如果对方只需要倾听，就暂时放下分析，之后再说你的判断。"
          }
        )
      }
    },
    JP: {
      name: "安排生活的方式", topic: "生活节奏",
      low: "J", high: "P", lowLabel: "判断", highLabel: "知觉",
      texts: {
        low: texts(
          "倾向提前安排、明确步骤，并按计划推进",
          "在这份回答里，你往往喜欢知道事情何时开始、怎样结束。有明确目标和清单时，你更容易进入状态；临时改动过多会让你烦躁，未完成的事项也可能持续占据注意力。",
          "这种取向适合需要稳定推进、协调多人和管理期限的任务。你可以把大目标拆成可完成的小块，并预留缓冲；在团队里，明确的节点和责任分工能让你和别人都更安心。",
          "计划感过强时，可能把弹性当成失控，或为了完成清单而忽略新信息。如果计划被打乱后你久久无法调整，可以先区分哪些节点真的不能动，再给其余部分留出重新安排的空间。",
          {
            work: "开始任务时，先定一个可交付的最小结果和截止时间，再排出步骤；每周留出一段不安排任务的时间，用来处理延误和临时事项。计划被打乱时，先保住最关键的一步，其余顺延。",
            recovery: "休息也可以有结构，但不要把恢复变成另一张清单。计划被打乱后，先做一件能明确结束的小事恢复掌控感，再决定是否重排；长期高压时，减少同时进行的项目，比提高效率更有用。"
          }
        ),
        high: texts(
          "倾向保留选择，在过程中根据情况调整",
          "在这份回答里，你往往先开始，再在过程中修正方向。过早定死细节可能让你失去兴趣；临近期限时，压力反而能帮你集中。你对临时变化通常比对固定流程更适应。",
          "这种取向适合需要探索、快速响应和保留余地的情境。你可以先做出可运行的版本，再逐步收紧；把外部节点和最小交付物说清楚，能让你在自由安排的同时不耽误别人。",
          "选择一直保留，也可能变成迟迟不开始，或把收尾拖到最后。如果你发现任务反复延期、承诺越积越多，可以把“决定何时开始”提前，并为一个版本设定明确的完成标准。",
          {
            work: "开始前只定三件事：最小交付物、第一个动作、外部截止时间。先做一个粗糙版本，再根据反馈调整；如果容易分心，把任务拆成能在一次专注时段内完成的小块，并记录下一步。",
            recovery: "没有结构的休息容易变成刷屏和拖延，反而更累。你可以给休息设一个大致边界，例如散步半小时或看完一集就停；如果长期没有节奏，先固定起床和吃饭时间，再慢慢加回其他安排。"
          }
        ),
        balanced: texts(
          "会在计划和弹性之间找一个当时合适的比例",
          "在这份回答里，你既需要一定的安排，也需要保留调整空间。目标清楚时，你愿意提前准备；情况不明时，你又不想被计划绑住。哪一边更突出，常取决于任务和当时的压力。",
          "这种弹性适合需要在稳定和变化之间找平衡的情境。你可以先定下少数不可移动的节点，其余部分留出余地；这样既能推进事情，也不会因为一点变化就全盘失效。",
          "两边都想要时，可能既没有真正排好，也没有彻底放松。留意自己是在用“灵活”拖延，还是在用“计划”缓解焦虑；给重要的事一个明确的开始时间，其余部分再自由安排。",
          {
            work: "先把截止时间和最小交付物写下来，再把任务分成“必须按顺序做”和“可以随时调整”两类。每周检查一次哪些安排仍然必要；计划外的变化出现时，只重排受影响的部分。",
            recovery: "恢复不必完全无结构，也不必排成任务清单。你可以给休息一个大致框架，例如固定睡觉时间、留半天不安排事情；如果计划被打乱，先做一件能结束的小事，再决定剩下的时间怎么用。"
          }
        )
      }
    }
  };

  var ORDER = ["IE", "SN", "FT", "JP"];

  var STRENGTHS = {
    balanced: { label: "中间带", text: "两侧得分接近，单次回答不足以判定方向。" },
    slight: { label: "轻微", text: "有一点倾向，但还很灵活，换一个场景可能就会不同。" },
    clear: { label: "明显", text: "倾向比较清楚，通常能在多个场景中感觉到。" },
    strong: { label: "很强", text: "倾向很强，但它描述的是偏好，不是能力或固定标签。" }
  };

  var INTERACTION_PAIRS = [
    {
      keys: ["SN", "FT"],
      title: "信息与判断：你怎样把观察变成决定",
      texts: {
        "low,low": "你先收集具体事实，也很在意当事人的感受，决定往往贴近现场。信息充分、关系信任时，这种组合让人感到被理解。压力下可能为了照顾情绪而推迟判断，或忽略长期模式；可以先把事实和感受分开写，再问哪些原则不能让步。",
        "low,high": "你依据具体证据和一致标准判断，表达通常直接。规则清楚、问题可验证时，这套组合效率很高。压力下可能低估情绪成本，让人觉得冷；作决定前补一句对处境的理解，并确认对方是否需要解释过程。",
        "high,low": "你先看可能性与人的处境，再形成判断，容易看见潜力和未被说出的需要。面对新问题或需要鼓舞时，这种组合很有用。压力下可能忽略执行细节或把善意当成理由；把关键假设写成可检验的步骤，能减少落差。",
        "high,high": "你从整体模式和原则出发，倾向先建立框架再决定。复杂、需要结构的问题里，这种组合容易抓住主线。压力下可能离具体经验太远，或把不同意见当成逻辑错误；刻意找一个反例和一位受影响的人，能校准判断。"
      }
    },
    {
      keys: ["IE", "JP"],
      title: "能量与节奏：你怎样安排一天",
      texts: {
        "low,low": "你常先在心里想清楚，再按计划推进，独处和准备时间对你很重要。目标明确、干扰较少时，这种组合能稳定产出。压力下可能把计划排得太满、很少求助；给日程留缓冲，并提前说明你需要安静，会更可持续。",
        "low,high": "你偏好保留空间、按状态调整，同时需要独处恢复。自主度高、没有密集会议时，这种组合比较自在。压力下容易拖到最后一刻，或在社交与独处之间失衡；设定一个外部节点，并保护固定的恢复时间。",
        "high,low": "你从互动中获得能量，也喜欢把安排定下来，常能推动事情发生。需要协调和明确节点的任务里，这种组合很顺手。压力下可能把日程排满、忽略了安静思考；刻意留出无会议时段，并允许别人有自己的节奏。",
        "high,high": "你在交流与变化中比较自在，计划更像起点而非约束。需要快速响应、多人协作的情境里，这种组合灵活。压力下容易承诺过多、收尾不足；把关键交付写下来，设一个比真正期限更早的内部节点。"
      }
    },
    {
      keys: ["IE", "FT"],
      title: "关系中的关心方式",
      texts: {
        "low,low": "你常以安静、具体的方式关心别人，未必直接说出口。关系稳定、彼此熟悉时，对方能感受到你的在意。压力下可能把需要藏起来，或期待对方自动读懂；用一句明确的话说明关心，也说明自己需要什么。",
        "low,high": "你更习惯用分析或解决问题来表达关心，而且往往做得多、说得少。对方需要实际帮助时，这种方式很可靠。压力下可能显得疏离，或把情绪当成待解决的问题；先问对方需要倾听还是建议，再决定怎么说。",
        "high,low": "你容易在交流中直接回应情绪，也愿意主动维持关系。需要安抚和陪伴的场合，这种组合很有力量。压力下可能承担过多情绪劳动，或忽略自己的界限；先确认哪些责任属于自己，再决定帮到什么程度。",
        "high,high": "你会把关心放进讨论、建议和行动里，表达直接而具体。问题清晰、对方愿意合作时，这种组合推进得很快。压力下可能把对话变成辩论，或忘记先安顿情绪；开口前先确认感受，再谈方案和标准。"
      }
    },
    {
      keys: ["SN", "JP"],
      title: "探索与收束：你怎样从想法走到完成",
      texts: {
        "low,low": "你先抓具体事实，再按既定步骤推进，通常能把事情稳稳做完。流程清楚、目标稳定的任务里，这种组合可靠。压力下可能过早锁定方案，错过新信息；在计划中留一个检查点，专门用来重新评估方向。",
        "low,high": "你依靠具体经验行动，同时保留调整空间，遇到变化能较快应对。需要边做边学的任务里，这种组合灵活。压力下可能缺少收尾，或同时开太多头；先定一个可交付的最小结果，再允许过程变化。",
        "high,low": "你先形成整体设想，再把它排进计划，容易兼顾方向和执行。目标明确、资源可控时，这种组合推进有力。压力下可能为了让计划成立而忽略现实反馈；把关键假设变成可验证的小步骤，定期核对。",
        "high,high": "你从可能性出发，边探索边调整，能发现别人没注意的方向。需要创意和快速试错的情境里，这种组合有活力。压力下容易想法多、落地少，或被新方向带走；为每个想法设一个最小实验和结束条件。"
      }
    },
    {
      keys: ["IE", "SN"],
      title: "能量与素材：你从哪里开始理解一件事",
      texts: {
        "low,low": "你倾向于独自消化具体信息，先把细节弄清楚再表达。需要准确理解和独立判断时，这种组合扎实。压力下可能收集过多信息、迟迟不行动；给自己设一个“足够开始”的标准，并把初步结论说出来接受反馈。",
        "low,high": "你常在心里连接信息、寻找模式，想法成形后才与人分享。需要深度思考和独立洞察时，这种组合较顺。压力下可能过度沉浸在自己的解释里；定期用具体事实核对，并找一个愿意质疑你的人讨论。",
        "high,low": "你通过交谈获取具体信息，也喜欢把细节说出来核对。需要快速掌握现场情况时，这种组合有效。压力下可能被大量细节和对话淹没，缺少整体判断；每隔一段时间停下来归纳重点，再决定下一步。",
        "high,high": "你在交流中连接可能性，想法容易在对话里迅速展开。需要激发新方向和整合信息时，这种组合活跃。压力下可能话题过多、缺少事实支撑；把讨论中的假设记下来，用具体数据或小实验逐一验证。"
      }
    },
    {
      keys: ["FT", "JP"],
      title: "决定与执行：你怎样把判断变成行动",
      texts: {
        "low,low": "你先照顾人的感受，再按计划把事情落实，决定通常考虑周全。关系稳定、目标明确时，这种组合让人安心。压力下可能为了维持和谐而推迟必要的调整；把原则和期限先说清楚，再讨论如何照顾各方。",
        "low,high": "你重视人的感受，也愿意根据情况调整做法，处理突发的人际问题较灵活。需要协商和临场照顾的场合里，这种组合合适。压力下可能不断让步或拖延决定；先确认自己的底线，再给出一个可执行的时间点。",
        "high,low": "你先确认标准和逻辑，再按计划推进，决定和执行都比较稳定。规则清楚、需要交付的任务里，这种组合高效。压力下可能把不同意见当成阻力，或忽略执行者的感受；在节点前留一次沟通，说明标准背后的考虑。",
        "high,high": "你依据原则分析，再在执行中保留调整空间，面对变化能保持距离感。需要快速判断和灵活处理的场景里，这种组合清楚。压力下可能显得强硬或忽略收尾；说明判断依据，也为情绪反应留出回应时间。"
      }
    }
  ];

  var SCENE_GROUPS = [
    { key: "work", title: "工作与学习", keys: ["SN", "JP"] },
    { key: "relationship", title: "关系与沟通", keys: ["IE", "FT"] },
    { key: "recovery", title: "压力与恢复", keys: ["IE", "JP"] }
  ];

  var CAVEATS = [
    "以上文字由页面内置的固定规则根据分数生成，不是 AI 推断，也不是心理诊断或能力评价。",
    "刻度位置是原始分在 8–40 量表上的线性位置，不是人群百分位、准确率或成为某类型的概率。",
    "中文题目为未经心理测量验证的试译；X 只表示 45%–55% 中间带，不表示“混合类型”，也不表示人格无法判断。",
    "整体叙述由四个维度的方向和强度按固定句式组合，同一组分数会得到同一段文字；它不是完整的个人描述。"
  ];

  freezeDeep(DIMENSIONS);
  freezeDeep(STRENGTHS);
  freezeDeep(INTERACTION_PAIRS);
  freezeDeep(SCENE_GROUPS);
  freezeDeep(CAVEATS);

  function fail(message) { throw new TypeError("Invalid scoring result: " + message); }

  function validate(scoreResult) {
    if (!scoreResult || typeof scoreResult !== "object" || !Array.isArray(scoreResult.dimensions)) fail("missing dimensions");
    if (scoreResult.dimensions.length !== ORDER.length) fail("expected four dimensions");
    scoreResult.dimensions.forEach(function (dimension, index) {
      var key = ORDER[index];
      if (!dimension || dimension.key !== key) fail("unexpected dimension order");
      if (!Number.isInteger(dimension.score) || dimension.score < 8 || dimension.score > 40) fail("invalid score for " + key);
      if (typeof dimension.position !== "number" || !Number.isFinite(dimension.position)) fail("invalid position for " + key);
      if (typeof dimension.distance !== "number" || !Number.isFinite(dimension.distance)) fail("invalid distance for " + key);
      if (typeof dimension.borderline !== "boolean") fail("invalid borderline flag for " + key);
    });
    if (typeof scoreResult.cautiousType !== "string" || !/^[IXE][SXN][FXT][JXP]$/.test(scoreResult.cautiousType)) fail("invalid cautiousType");
    if (typeof scoreResult.originalType !== "string" || !/^[IE][SN][FT][JP]$/.test(scoreResult.originalType)) fail("invalid originalType");
  }

  function sideOf(dimension) {
    return dimension.borderline ? "balanced" : dimension.score > 24 ? "high" : "low";
  }

  function strengthOf(dimension) {
    if (dimension.borderline) return "balanced";
    if (dimension.distance <= 4) return "slight";
    if (dimension.distance <= 9) return "clear";
    return "strong";
  }

  function directionLabel(key, side) {
    var meta = DIMENSIONS[key];
    if (side === "balanced") return "中间带";
    return side === "low" ? meta.low + " · " + meta.lowLabel : meta.high + " · " + meta.highLabel;
  }

  function scoreLine(dimension) {
    var line = "原始分 " + dimension.score + " / 40 · 刻度位置 " + dimension.position.toFixed(1) + "%";
    return dimension.borderline ? line + " · 中间带 45%–55%" : line;
  }

  function buildSummary(result, dimensions, balancedCount, candidateCount) {
    var resolvedCount = dimensions.length - balancedCount;
    var summary = [];
    if (balancedCount === 0) {
      summary.push("四个维度都在中间带之外，本次回答可读作 " + result.cautiousType + "；这是此刻的偏好轮廓，不是固定人格。");
    } else if (resolvedCount === 0) {
      summary.push("四个维度都落在 45%–55% 的中间带内，本次回答没有足够依据判定任何一侧。这不等于四个维度都处在中间水平，只说明这次回答没有拉开方向差异。");
    } else {
      summary.push(resolvedCount + " 个维度有较明确方向，" + balancedCount + " 个位于 45%–55% 中间带，暂时用 X 表示。");
    }
    var counts = { strong: 0, clear: 0, slight: 0 };
    dimensions.forEach(function (dimension) { if (dimension.strength !== "balanced") counts[dimension.strength] += 1; });
    if (resolvedCount > 0) {
      var parts = [];
      if (counts.strong) parts.push(counts.strong + " 个很强");
      if (counts.clear) parts.push(counts.clear + " 个明显");
      if (counts.slight) parts.push(counts.slight + " 个轻微");
      summary.push("强度分布：" + parts.join("、") + "。强度只描述这次回答偏离中点的幅度，不代表能力高低。");
    } else {
      summary.push("没有可报告的强度分布：强度只有在维度离开中间带后才会分档。");
    }
    if (balancedCount > 0) {
      summary.push("若把每个中间带的两种方向都算上，会展开为 " + candidateCount + " 种四字母组合。这里不按可能性排序，也不预测你会成为哪一种；它只说明本次回答保留了多少种读法。");
    }
    summary.push("原量表在恰好 24 分时归入低侧字母；本页把 23–25 分都视为中间带，因此四字母可能与原规则不同。原规则结果 " + result.originalType + " 保留在此，供你对照。");
    return summary;
  }

  function buildOverall(scoreResult, dimensions, balancedCount) {
    var resolvedCount = dimensions.length - balancedCount;
    var sourceDistance = {};
    scoreResult.dimensions.forEach(function (dimension) { sourceDistance[dimension.key] = dimension.distance; });
    var maxDimension = dimensions[0];
    dimensions.forEach(function (dimension) {
      if (sourceDistance[dimension.key] > sourceDistance[maxDimension.key]) maxDimension = dimension;
    });
    var overall = [];
    if (balancedCount === 4) {
      overall.push("四个维度都落在 45%–55% 的中间带，这份回答没有把任何一维明确推向某一侧。它更像一张尚未定稿的草图：换一个场景或过一段时间，你的表现可能有所不同。");
    } else if (balancedCount === 0) {
      overall.push("四个维度都落在中间带之外，方向合起来可以读作 " + scoreResult.cautiousType + "。偏离中点最多的是" + maxDimension.name + "（" + scoreResult.dimensions[ORDER.indexOf(maxDimension.key)].score + " 分），说明这一维在本次回答中最清楚。");
    } else {
      overall.push(resolvedCount + " 个维度有较明确方向，" + balancedCount + " 个位于 45%–55% 中间带，暂时以 X 表示。偏离中点最多的是" + maxDimension.name + "（" + scoreResult.dimensions[ORDER.indexOf(maxDimension.key)].score + " 分）。");
    }
    var byKey = {};
    dimensions.forEach(function (dimension) { byKey[dimension.key] = dimension; });
    overall.push("在与外界互动时，你" + DIMENSIONS.IE.texts[byKey.IE.side].clause + "。在获取信息时，你" + DIMENSIONS.SN.texts[byKey.SN.side].clause + "。这两组偏好共同影响你从哪里获得能量、又从哪里理解一件事。");
    overall.push("做判断时，你" + DIMENSIONS.FT.texts[byKey.FT.side].clause + "。安排生活时，你" + DIMENSIONS.JP.texts[byKey.JP.side].clause + "。这两组偏好共同影响你怎样做决定和推进事情。");
    if (balancedCount === 4) {
      overall.push("中间带不表示无法判断，只表示这次回答没有提供足够的方向差异。回到具体情境观察，往往比急着给自己定一个字母更有用；环境和阶段也会让表现发生变化。以上叙述同样由四个维度的方向按固定句式组合。");
    } else {
      overall.push("长期使用相反一侧通常更费力，但这不等于做不到；环境、角色和阶段都会改变表现。以上叙述由四个维度的方向与强度按固定句式组合，同一组分数会得到同一段文字。如果这些描述与你的实际感受不符，以你的观察为准，不必为了让结果成立而改变自己。");
    }
    return overall;
  }

  function buildInteractions(dimensionsByKey, sourceDistance) {
    var candidates = [];
    INTERACTION_PAIRS.forEach(function (pair, index) {
      var first = dimensionsByKey[pair.keys[0]];
      var second = dimensionsByKey[pair.keys[1]];
      if (!first || !second || first.side === "balanced" || second.side === "balanced") return;
      candidates.push({
        keys: pair.keys.slice(),
        title: pair.title,
        text: pair.texts[first.side + "," + second.side],
        distance: sourceDistance[pair.keys[0]] + sourceDistance[pair.keys[1]],
        order: index
      });
    });
    candidates.sort(function (a, b) {
      return b.distance - a.distance || a.order - b.order;
    });
    return candidates.slice(0, 3).map(function (item) {
      return { keys: item.keys, title: item.title, text: item.text };
    });
  }

  function buildScenes(dimensionsByKey) {
    return SCENE_GROUPS.map(function (group) {
      return {
        key: group.key,
        title: group.title,
        items: group.keys.map(function (key) {
          var dimension = dimensionsByKey[key];
          return {
            key: key,
            name: DIMENSIONS[key].name,
            label: dimension.directionLabel,
            text: DIMENSIONS[key].texts[dimension.side].scenes[group.key]
          };
        })
      };
    });
  }

  function interpret(scoreResult) {
    validate(scoreResult);
    var dimensionsByKey = {};
    var sourceDistance = {};
    scoreResult.dimensions.forEach(function (dimension) { sourceDistance[dimension.key] = dimension.distance; });
    var dimensions = scoreResult.dimensions.map(function (dimension) {
      var side = sideOf(dimension);
      var strength = strengthOf(dimension);
      var meta = DIMENSIONS[dimension.key];
      var copy = meta.texts[side];
      var item = {
        key: dimension.key,
        name: meta.name,
        side: side,
        directionLabel: directionLabel(dimension.key, side),
        strength: strength,
        strengthLabel: STRENGTHS[strength].label,
        strengthNote: STRENGTHS[strength].text,
        expression: copy.expression,
        upside: copy.upside,
        watch: copy.watch,
        scoreLine: scoreLine(dimension)
      };
      dimensionsByKey[dimension.key] = item;
      return item;
    });
    var balancedCount = dimensions.filter(function (dimension) { return dimension.side === "balanced"; }).length;
    var candidateCount = Math.pow(2, balancedCount);
    var interactions = buildInteractions(dimensionsByKey, sourceDistance);
    var headline = balancedCount === 0
      ? "你的回答整体偏向 " + scoreResult.cautiousType
      : "你的回答目前呈现为 " + scoreResult.cautiousType;
    return freezeDeep({
      headline: headline,
      summary: buildSummary(scoreResult, dimensions, balancedCount, candidateCount),
      overall: buildOverall(scoreResult, dimensions, balancedCount),
      dimensions: dimensions,
      interactions: interactions,
      scenes: buildScenes(dimensionsByKey),
      caveats: CAVEATS,
      candidateCount: candidateCount
    });
  }

  return Object.freeze({
    DIMENSIONS: DIMENSIONS,
    STRENGTHS: STRENGTHS,
    INTERACTION_PAIRS: INTERACTION_PAIRS,
    SCENE_GROUPS: SCENE_GROUPS,
    interpret: interpret
  });
});
