import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface StudyQuote {
  id: number;
  text: string;
  author: string;
  category?: string;
}

/**
 * 105 Unique Vietnamese Inspirational Quotes on Education, Learning, Perseverance & Knowledge
 */
export const VIETNAMESE_STUDY_QUOTES: StudyQuote[] = [
  { id: 1, text: 'Học, học nữa, học mãi.', author: 'V.I. Lenin' },
  { id: 2, text: 'Hiền tài là nguyên khí của quốc gia, nguyên khí thịnh thì thế nước mạnh mà hưng thịnh.', author: 'Thân Nhân Trung' },
  { id: 3, text: 'Vì lợi ích mười năm thì phải trồng cây, vì lợi ích trăm năm thì phải trồng người.', author: 'Chủ tịch Hồ Chí Minh' },
  { id: 4, text: 'Giáo dục là vũ khí mạnh nhất mà người ta có thể sử dụng để thay đổi cả thế giới.', author: 'Nelson Mandela' },
  { id: 5, text: 'Đầu tư vào tri thức luôn mang lại lãi suất cao nhất.', author: 'Benjamin Franklin' },
  { id: 6, text: 'Rễ của sự học thì đắng cay, nhưng quả của nó lại vô cùng ngọt ngào.', author: 'Aristotle' },
  { id: 7, text: 'Học tập không phải là việc ngày một ngày hai, mà là hành trình bền bỉ suốt cả cuộc đời.', author: 'Khuyết danh' },
  { id: 8, text: 'Ngọc không mài không thành đồ quý, người không học không biết rõ đạo lý.', author: 'Lễ Ký' },
  { id: 9, text: 'Biết một ngoại ngữ mới là sống thêm một cuộc đời mới.', author: 'Ngạn ngữ Séc' },
  { id: 10, text: 'Giới hạn của ngôn ngữ chính là giới hạn thế giới của bạn.', author: 'Ludwig Wittgenstein' },
  { id: 11, text: 'Hãy sống như thể bạn sẽ chết vào ngày mai. Hãy học như thể bạn sẽ sống mãi mãi.', author: 'Mahatma Gandhi' },
  { id: 12, text: 'Không có con đường tắt nào dẫn đến những nơi xứng đáng để đặt chân tới.', author: 'Beverly Sills' },
  { id: 13, text: 'Thiên tài chỉ có 1% là năng khiếu bẩm sinh, còn 99% là mồ hôi và nước mắt.', author: 'Thomas Edison' },
  { id: 14, text: 'Đi một ngày đàng, học một sàng khôn.', author: 'Tục ngữ Việt Nam' },
  { id: 15, text: 'Có công mài sắt, có ngày nên kim.', author: 'Tục ngữ Việt Nam' },
  { id: 16, text: 'Muốn biết phải hỏi, muốn giỏi phải học.', author: 'Tục ngữ Việt Nam' },
  { id: 17, text: 'Học mà không suy nghĩ thì uổng công; suy nghĩ mà không học thì hiểm nghèo.', author: 'Khổng Tử' },
  { id: 18, text: 'Tri thức là sức mạnh.', author: 'Francis Bacon' },
  { id: 19, text: 'Tương lai thuộc về những người chuẩn bị cho nó ngay từ hôm nay.', author: 'Malcolm X' },
  { id: 20, text: 'Sự học như con thuyền đi trên dòng nước ngược, không tiến ắt sẽ phải lùi.', author: 'Ngạn ngữ phương Đông' },
  { id: 21, text: 'Đừng xấu hổ khi không biết, chỉ xấu hổ khi không chịu học.', author: 'Ngạn ngữ Nga' },
  { id: 22, text: 'Mỗi từ vựng bạn học hôm nay là một viên gạch xây nên cây cầu nối bạn với thế giới ngày mai.', author: 'Mr.Harry' },
  { id: 23, text: 'Thành công là tổng hợp của những nỗ lực nhỏ bé được lặp đi lặp lại mỗi ngày.', author: 'Robert Collier' },
  { id: 24, text: 'Người hỏi một câu có thể ngốc trong năm phút, nhưng người không hỏi sẽ mãi không biết gì.', author: 'Ngạn ngữ Trung Hoa' },
  { id: 25, text: 'Đọc sách không bằng suy ngẫm, học trường không bằng học đời, nhưng nền tảng luôn bắt đầu từ trang sách.', author: 'Immanuel Kant' },
  { id: 26, text: 'Không có gì quý hơn sự tự học. Tự học là chiếc chìa khóa mở ra mọi kho tàng tri thức.', author: 'Nguyễn Cảnh Toàn' },
  { id: 27, text: 'Hôm nay bạn đọc một trang sách, ngày mai bạn nhìn thế giới cao hơn một bậc.', author: 'Khuyết danh' },
  { id: 28, text: 'Kỷ luật là cây cầu nối giữa mục tiêu và thành tựu.', author: 'Jim Rohn' },
  { id: 29, text: 'Chặng đường ngàn dặm luôn bắt đầu từ một bước chân đầu tiên.', author: 'Lão Tử' },
  { id: 30, text: 'Đừng đợi đến khi sẵn sàng mới bắt đầu; chính việc bắt đầu sẽ giúp bạn sẵn sàng.', author: 'Khuyết danh' },
  { id: 31, text: 'Khó khăn của ngày hôm nay chính là sức mạnh của bạn vào ngày mai.', author: 'Khuyết danh' },
  { id: 32, text: 'Bộ não giống như một chiếc dù, nó chỉ hoạt động tốt nhất khi được mở rộng.', author: 'Albert Einstein' },
  { id: 33, text: 'Tôi không bao giờ thất bại. Tôi chỉ là đã tìm ra 10.000 cách chưa hoạt động mà thôi.', author: 'Thomas Edison' },
  { id: 34, text: 'Nơi nào có ý chí, nơi đó có con đường.', author: 'Ngạn ngữ Anh' },
  { id: 35, text: 'Học vấn có những chùm rễ đắng cay nhưng hoa trái lại ngọt ngào.', author: 'Ngạn ngữ Hy Lạp' },
  { id: 36, text: 'Điều tuyệt vời của việc học là không ai có thể lấy cắp nó khỏi bạn.', author: 'B.B. King' },
  { id: 37, text: 'Người thông thái không phải là người biết tất cả, mà là người không bao giờ ngừng học hỏi.', author: 'Socrates' },
  { id: 38, text: 'Mọi chuyên gia đều từng là một người mới bắt đầu.', author: 'Helen Hayes' },
  { id: 39, text: 'Sự kiên trì có thể biến điều không thể thành điều có thể.', author: 'Khuyết danh' },
  { id: 40, text: 'Nếu bạn không chịu bước đi hôm nay, ngày mai bạn sẽ phải chạy thật vất vả.', author: 'Ngạn ngữ Giáo dục' },
  { id: 41, text: 'Cần cù bù thông minh.', author: 'Tục ngữ Việt Nam' },
  { id: 42, text: 'Kiến tha lâu cũng đầy tổ; tri thức góp nhặt mỗi ngày sẽ làm nên đại dương.', author: 'Tục ngữ Việt Nam' },
  { id: 43, text: 'Thất bại đơn giản là cơ hội để bắt đầu lại một cách thông minh hơn.', author: 'Henry Ford' },
  { id: 44, text: 'Giáo dục không phải là việc đổ đầy một chiếc bình, mà là thắp sáng một ngọn lửa.', author: 'William Butler Yeats' },
  { id: 45, text: 'Sách mở ra trước mắt tôi những chân trời mới.', author: 'Maxim Gorky' },
  { id: 46, text: 'Hãy học khi người khác ngủ; lao động khi người khác lười nhác; chuẩn bị khi người khác chơi bời.', author: 'William Arthur Ward' },
  { id: 47, text: 'Tương lai của bạn phụ thuộc vào rất nhiều điều, nhưng chủ yếu là vào chính bạn.', author: 'Frank Tyger' },
  { id: 48, text: 'Nỗi đau của sự kỷ luật chỉ nặng vài gam, nhưng nỗi đau của sự hối tiếc nặng hàng tấn.', author: 'Jim Rohn' },
  { id: 49, text: 'Chậm cũng được, miễn là bạn không bao giờ dừng lại.', author: 'Khổng Tử' },
  { id: 50, text: 'Một tâm trí được mở rộng bởi một trải nghiệm mới sẽ không bao giờ quay lại kích thước cũ.', author: 'Oliver Wendell Holmes' },
  { id: 51, text: 'Cách tốt nhất để dự đoán tương lai là tự tay kiến tạo nên nó.', author: 'Abraham Lincoln' },
  { id: 52, text: 'Học ngoại ngữ là rèn luyện sự kiên nhẫn: nghe mỗi ngày một chút, đọc mỗi ngày một đoạn.', author: 'Mr.Harry' },
  { id: 53, text: 'Không có thang máy nào đưa bạn thẳng đến thành công, bạn phải đi từng bậc thang một.', author: 'Zig Ziglar' },
  { id: 54, text: 'Trí tuệ không phải là sản phẩm của trường học, mà là của nỗ lực tự học suốt đời.', author: 'Albert Einstein' },
  { id: 55, text: 'Khi bạn muốn bỏ cuộc, hãy nhớ tới lý do khiến bạn bắt đầu.', author: 'Khuyết danh' },
  { id: 56, text: 'Một người ngừng học tập thì đã già, dù ở tuổi hai mươi hay tám mươi.', author: 'Henry Ford' },
  { id: 57, text: 'Hãy biến việc học thành thói quen mỗi sáng, như hơi thở và ánh nắng ban mai.', author: 'Khuyết danh' },
  { id: 58, text: 'Nước chảy đá mòn; chỉ cần bền chí thì mục tiêu lớn đến mấy cũng sẽ chinh phục được.', author: 'Tục ngữ Việt Nam' },
  { id: 59, text: 'Sự khác biệt giữa người thành công và người khác không phải là thiếu sức mạnh hay kiến thức, mà là thiếu ý chí.', author: 'Vince Lombardi' },
  { id: 60, text: 'Học tập là hạt giống của kiến thức, kiến thức là hạt giống của hạnh phúc.', author: 'Ngạn ngữ Gruzia' },
  { id: 61, text: 'Đừng so sánh chương 1 của bạn với chương 20 của người khác; hãy tập trung viết tốt trang hôm nay.', author: 'Khuyết danh' },
  { id: 62, text: 'Bí quyết của sự tiến bộ là bắt đầu ngay lúc này.', author: 'Mark Twain' },
  { id: 63, text: 'Mỗi sai lầm trong lúc luyện đề là một bài học quý giá giúp bạn tỏa sáng trong phòng thi thật.', author: 'Mr.Harry' },
  { id: 64, text: 'Tri thức làm người ta khiêm tốn, sự ngu dốt làm người ta kiêu ngạo.', author: 'Ngạn ngữ Anh' },
  { id: 65, text: 'Bông lúa càng chín càng cúi đầu; người càng học rộng càng khiêm nhường.', author: 'Ngạn ngữ Nhật Bản' },
  { id: 66, text: 'Thời gian bạn dành cho việc học hôm nay sẽ trả ơn bạn gấp bội trong tương lai.', author: 'Khuyết danh' },
  { id: 67, text: 'Hãy nói cho tôi nghe và tôi sẽ quên. Hãy dạy tôi và tôi có thể nhớ. Hãy để tôi tự thực hành và tôi sẽ thấu hiểu.', author: 'Benjamin Franklin' },
  { id: 68, text: 'Đọc vạn quyển sách, đi vạn dặm đường.', author: 'Đổng Kỳ Xương' },
  { id: 69, text: 'Sự chuẩn bị kỹ lưỡng ngày hôm nay là bảo chứng vững chắc nhất cho chiến thắng ngày mai.', author: 'Seneca' },
  { id: 70, text: 'May mắn là giao điểm khi sự chuẩn bị kỹ càng gặp gỡ cơ hội.', author: 'Seneca' },
  { id: 71, text: 'Không ai tắm hai lần trên một dòng sông; mỗi ngày trôi qua hãy làm mới mình bằng tri thức.', author: 'Heraclitus' },
  { id: 72, text: 'Học ăn, học nói, học gói, học mở.', author: 'Tục ngữ Việt Nam' },
  { id: 73, text: 'Văn ôn võ luyện; ngôn ngữ không rèn luyện mỗi ngày sẽ mai một.', author: 'Tục ngữ Việt Nam' },
  { id: 74, text: 'Sức mạnh không đến từ những gì bạn đã làm được, nó đến từ việc vượt qua những điều bạn từng nghĩ mình không thể.', author: 'Rikki Rogers' },
  { id: 75, text: 'Nếu bạn thấy việc học thật vất vả, nghĩa là bạn đang lên dốc và tiến gần hơn đến đỉnh núi.', author: 'Khuyết danh' },
  { id: 76, text: 'Một giờ tập trung cao độ có giá trị hơn cả ngày học tập trong sự xao nhãng.', author: 'Cal Newport' },
  { id: 77, text: 'Người chiến thắng không phải là người không bao giờ vấp ngã, mà là người không bao giờ bỏ cuộc.', author: 'Vince Lombardi' },
  { id: 78, text: 'Không có kho báu nào quý giá bằng học thức, không có trang sức nào lấp lánh bằng trí tuệ.', author: 'Đức Phật' },
  { id: 79, text: 'Hãy đặt mục tiêu vươn tới mặt trăng; dù có trượt, bạn vẫn sẽ hạ cánh giữa những vì sao.', author: 'Les Brown' },
  { id: 80, text: 'Thói quen nhỏ mỗi ngày tạo nên sự thay đổi vĩ đại sau một năm.', author: 'James Clear' },
  { id: 81, text: 'Tự tin không đến từ việc luôn đúng, mà đến từ việc không sợ sai khi đang học hỏi.', author: 'Peter T. McIntyre' },
  { id: 82, text: 'Con đường dẫn đến thành công luôn đang được thi công bởi những người chăm chỉ.', author: 'Lily Tomlin' },
  { id: 83, text: 'Học tập là tấm hộ chiếu đưa bạn đi khắp thế giới với tư thế ngẩng cao đầu.', author: 'Khuyết danh' },
  { id: 84, text: 'Sự tò mò là ngọn bấc trong cây nến của sự học hỏi.', author: 'William Arthur Ward' },
  { id: 85, text: 'Người biết đọc mà không chịu đọc thì chẳng hơn gì người không biết chữ.', author: 'Mark Twain' },
  { id: 86, text: 'Tri thức là kho báu duy nhất càng chia sẻ lại càng sinh sôi nảy nở.', author: 'Khuyết danh' },
  { id: 87, text: 'Mỗi bài nghe, mỗi bài đọc hôm nay đều đang âm thầm nâng tầm năng lực tiếng Anh của bạn.', author: 'Mr.Harry' },
  { id: 88, text: 'Đừng hạ thấp mục tiêu của bạn, hãy nâng cao sự nỗ lực của chính mình.', author: 'Grant Cardone' },
  { id: 89, text: 'Không có áp lực thì không có kim cương; không có rèn luyện thì không có vinh quang.', author: 'Thomas Carlyle' },
  { id: 90, text: 'Học tập giúp tâm hồn luôn trẻ trung và đôi mắt luôn sáng rõ trước mọi biến động.', author: 'Solon' },
  { id: 91, text: 'Cây muốn vững phải bén rễ sâu; người muốn giỏi phải chắc kiến thức nền tảng.', author: 'Khuyết danh' },
  { id: 92, text: 'Thời điểm tốt nhất để trồng một cái cây là 20 năm trước. Thời điểm tốt thứ hai chính là ngay bây giờ.', author: 'Ngạn ngữ phương Đông' },
  { id: 93, text: 'Hãy kiên nhẫn với chính mình. Không có đóa hoa nào vừa gieo hạt đã nở rộ ngay trong một ngày.', author: 'Khuyết danh' },
  { id: 94, text: 'Điều quan trọng không phải là bạn xuất phát ở đâu, mà là bạn đang kiên trì hướng về đâu.', author: 'Brian Tracy' },
  { id: 95, text: 'Tri thức giống như ánh sáng: nó không có trọng lượng nhưng lại soi sáng mọi con đường tối tăm nhất.', author: 'Khuyết danh' },
  { id: 96, text: 'Hãy tự hào về từng bước tiến nhỏ của bản thân mỗi ngày.', author: 'Khuyết danh' },
  { id: 97, text: 'Sự vĩ đại bắt nguồn từ những khởi đầu khiêm tốn nhưng bền bỉ.', author: 'Francis Drake' },
  { id: 98, text: 'Không có giới hạn nào cho những gì bạn có thể đạt được khi bạn kết hợp đam mê với sự chăm chỉ.', author: 'Michael Jordan' },
  { id: 99, text: 'Một cuốn sách hay trên giá sách là một người bạn dù quay lưng lại nhưng vẫn là bạn tốt.', author: 'Ngạn ngữ' },
  { id: 100, text: 'Chìa khóa của mọi kỳ thi là sự bình tĩnh, hiểu rõ cấu trúc đề và luyện tập có phương pháp.', author: 'Mr.Harry' },
  { id: 101, text: 'Học để biết, học để làm, học để chung sống, học để tự khẳng định mình.', author: 'UNESCO' },
  { id: 102, text: 'Nỗ lực của bạn hôm nay chính là món quà ý nghĩa nhất dành cho phiên bản tương lai của bạn.', author: 'Khuyết danh' },
  { id: 103, text: 'Đừng sợ đi chậm, chỉ sợ đứng yên tại chỗ.', author: 'Ngạn ngữ' },
  { id: 104, text: 'Tấm bằng hay chứng chỉ là minh chứng cho cả một hành trình bạn đã vượt lên chính mình.', author: 'Mr.Harry' },
  { id: 105, text: 'Hãy giữ cho tâm trí luôn khát khao tri thức và trái tim luôn dũng cảm bước tiếp.', author: 'Steve Jobs' },
];

/**
 * Deterministically selects a unique quote for each calendar day of the year
 * so every day has a distinct quote without repeats across 105 consecutive days.
 */
export function getDailyQuote(date: Date = new Date()): StudyQuote {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = Math.abs(dayOfYear) % VIETNAMESE_STUDY_QUOTES.length;
  return VIETNAMESE_STUDY_QUOTES[index];
}

/**
 * Picks a random quote guaranteed to be different from currentId
 */
export function getRandomDifferentQuote(currentId: number): StudyQuote {
  if (VIETNAMESE_STUDY_QUOTES.length <= 1) return VIETNAMESE_STUDY_QUOTES[0];
  let candidate = VIETNAMESE_STUDY_QUOTES[0];
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * VIETNAMESE_STUDY_QUOTES.length);
    if (VIETNAMESE_STUDY_QUOTES[idx].id !== currentId) {
      candidate = VIETNAMESE_STUDY_QUOTES[idx];
      break;
    }
  }
  if (candidate.id === currentId) {
    const nextIdx =
      (VIETNAMESE_STUDY_QUOTES.findIndex((q) => q.id === currentId) + 1) %
      VIETNAMESE_STUDY_QUOTES.length;
    candidate = VIETNAMESE_STUDY_QUOTES[nextIdx];
  }
  return candidate;
}

/**
 * Returns the time-of-day English greeting ("Good morning", "Good afternoon", "Good evening")
 */
export function getTimeOfDayGreeting(date: Date = new Date()): {
  greeting: 'Good morning' | 'Good afternoon' | 'Good evening';
  periodLabelVi: string;
} {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', periodLabelVi: 'Buổi sáng tràn đầy năng lượng' };
  }
  if (hour >= 12 && hour < 18) {
    return { greeting: 'Good afternoon', periodLabelVi: 'Buổi chiều tập trung bứt phá' };
  }
  return { greeting: 'Good evening', periodLabelVi: 'Buổi tối ôn luyện hiệu quả' };
}

const NICKNAME_STORAGE_KEY_PREFIX = 'langcert_user_nickname_';

export function getSavedNickname(uid?: string, fallbackName?: string): string {
  const key = `${NICKNAME_STORAGE_KEY_PREFIX}${uid || 'guest'}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }
  } catch {
    // Ignore storage error
  }
  return fallbackName?.trim() || 'Học viên LanguageCert';
}

export async function saveUserNickname(uid: string | undefined, nickname: string): Promise<void> {
  const clean = nickname.trim();
  const key = `${NICKNAME_STORAGE_KEY_PREFIX}${uid || 'guest'}`;
  try {
    if (clean) {
      localStorage.setItem(key, clean);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }

  if (uid) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { nickname: clean, updatedAt: Date.now() }, { merge: true });
    } catch {
      // Ignore permission or offline errors
    }
  }
}
