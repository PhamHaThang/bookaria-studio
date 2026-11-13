import { MAX_IMPORT_PAGES } from '@/features/books/model/import-source';
import { ASSET_MAX_BYTES } from '@/shared/contracts/api/assets.schema';
import { MB } from '@/shared/contracts/common.schema';

export const chapters = [
    {
        id: 'tao-sach',
        title: 'Tạo và biên soạn sách',
        intro: 'Chuẩn bị khổ sách và nội dung trang trước khi đặt các đối tượng tương tác.',
        steps: [
            {
                title: 'Chọn cách bắt đầu',
                text: `Mở Studio trên máy tính, chọn Tạo sách và nhập tên. Chọn Sách trống để bắt đầu với một trang, hoặc Nhập PDF / ảnh để dùng tài liệu có sẵn. Với PDF, chọn những trang cần nhập. Với ảnh, kiểm tra thứ tự trước khi tạo. Mỗi lần nhập hỗ trợ tối đa ${MAX_IMPORT_PAGES} trang, một PDF tối đa 50 MB hoặc nhiều JPG/PNG tối đa 10 MB mỗi ảnh.`,
            },
            {
                title: 'Đặt khổ sách và thông tin',
                text: 'Chọn khổ có sẵn hoặc chọn Tùy chỉnh để nhập chiều rộng và chiều cao theo milimét. Nếu sẽ in, đặt khổ đúng với bản in ngay từ đầu. Thêm ảnh bìa, mô tả, chủ đề, ngôn ngữ và độ tuổi phù hợp nếu có.',
            },
            {
                title: 'Sắp xếp các trang',
                text: 'Dùng dấu cộng ở thanh trang dưới canvas để thêm trang. Kéo hình thu nhỏ để đổi thứ tự, hoặc mở menu trên hình thu nhỏ để đổi tên và quản lý trang. Khi được nhắc, lưu thay đổi trước khi tiếp tục.',
            },
            {
                title: 'Chỉnh từng trang và lưu',
                text: 'Mở Thiết lập trang để đổi ảnh nền, ánh sáng, âm thanh nền hoặc lời thuyết minh. Bấm Lưu thay đổi trong bảng thiết lập, rồi dùng Lưu sách trên header để lưu bản nháp.',
            },
        ],
    },
    {
        id: 'noi-dung',
        title: 'Thêm nội dung và tương tác',
        intro: 'Thêm tài nguyên vào trang rồi quyết định chuyện gì xảy ra khi người đọc chạm vào đối tượng.',
        steps: [
            {
                title: 'Thêm tài nguyên hoặc văn bản',
                text: 'Ở thanh trái, chọn Mô hình 3D, Hình ảnh, Video hoặc Âm thanh. Chọn tệp đã sẵn sàng trong thư viện hoặc tải lên từ máy. Dùng Văn bản để thêm chữ, thẻ thông tin, bong bóng hoặc chú thích. Với chú thích, chọn vị trí đặt trên trang sau khi xác nhận thêm.',
            },
            {
                title: 'Đặt và kiểm tra đối tượng',
                text: 'Nhấp vào đối tượng, dùng tay nắm để di chuyển, xoay và đổi kích thước. Bảng thuộc tính cho phép nhập số chính xác và chỉnh các tùy chọn riêng, chẳng hạn hoạt ảnh 3D, âm lượng hoặc hiển thị khi mở trang. Đổi sang Phối cảnh để kiểm tra chiều cao so với mặt giấy.',
            },
            {
                title: 'Thử luồng chạm mô hình để phát âm thanh',
                text: 'Thêm một mô hình 3D và một tệp âm thanh vào cùng trang. Mở Tương tác, bấm dấu cộng rồi chọn Luồng mới. Trong khối bắt đầu, chọn Khi chạm đối tượng và chỉ định mô hình. Thêm và nối một khối Hành động, chọn Âm thanh, thao tác Phát, rồi chọn tệp âm thanh đã thêm.',
            },
            {
                title: 'Chạy thử trước khi xuất bản',
                text: 'Bấm Chạy thử trong Tương tác và chạm vào mô hình để kiểm tra âm thanh. Với luồng có câu hỏi hoặc điều kiện, thử từng câu trả lời và cả hai nhánh. Sau đó mở Xem trước để đọc từ đầu và kiểm tra cách các trang nối tiếp nhau.',
            },
        ],
    },
    {
        id: 'xuat-ban',
        title: 'Xuất bản và chia sẻ',
        intro: 'Sách có thể đọc trên màn hình. Nếu muốn quét bản in, thiết lập nhận diện cho từng trang có AR trước khi xuất bản.',
        steps: [
            {
                title: 'Chọn cách nhận diện cho bản in',
                text: 'Mở AR Marker của trang. Dùng ảnh trang khi muốn camera nhận diện trực tiếp hình in, hoặc chọn Marker Bookaria và đặt vị trí marker. Chọn Không dùng AR cho trang chỉ đọc trên màn hình. Kiểm tra chất lượng nhận diện và thay ảnh nếu hệ thống báo khó quét.',
            },
            {
                title: 'Kiểm tra và xuất bản',
                text: 'Lưu sách rồi mở Xuất bản. Mở từng trang được báo lỗi để sửa, kiểm tra lại và xem các khuyến nghị. Chọn Công khai để sách xuất hiện trong Khám phá sách, hoặc Qua liên kết để người có đường dẫn mở sách.',
            },
            {
                title: 'Gửi liên kết hoặc chuẩn bị bản in',
                text: 'Khi xuất bản xong, mở Chia sẻ để sao chép liên kết hoặc tải mã QR. Trong tab Sách in, chọn Sách PDF có marker hoặc Tờ marker để dán nếu đã dùng Marker Bookaria. Kiểm tra bố cục, bấm Tạo PDF và in ở kích thước thực để giữ đúng tỉ lệ.',
            },
            {
                title: 'Cập nhật phiên bản đã chia sẻ',
                text: 'Tiếp tục sửa trong bản nháp. Khi sẵn sàng, xuất bản lại để cập nhật nội dung người đọc thấy. Bạn có thể xem lịch sử trong tab Phiên bản và tạo lại PDF cho phiên bản đang phát hành.',
            },
        ],
    },
    {
        id: 'doc-sach',
        title: 'Đọc và trải nghiệm sách',
        intro: 'Mở sách trong trình duyệt trên điện thoại hoặc máy tính. Với bản in, hãy dùng thiết bị có camera.',
        steps: [
            {
                title: 'Mở đúng cuốn sách',
                text: 'Chọn sách trong Khám phá sách, mở liên kết được gửi hoặc quét QR trên bìa bằng camera điện thoại. Sách đã được chia sẻ có thể mở mà không cần tài khoản.',
            },
            {
                title: 'Đọc và tương tác trên màn hình',
                text: 'Chọn Bắt đầu đọc hoặc Đọc trên màn hình. Dùng thanh trang hoặc nút danh sách trang để chuyển trang. Chạm vào đối tượng để mở nội dung. Trên điện thoại, kéo để xoay góc nhìn và chụm hai ngón tay để thu phóng.',
            },
            {
                title: 'Quét trang sách in',
                text: 'Chọn Quét sách rồi bấm Cho phép camera. Đặt sách phẳng dưới ánh sáng đều, hướng camera vào đúng trang hoặc marker và giữ trọn hình trong khung. Khi nội dung hiện lên, giữ camera hướng về trang để tiếp tục tương tác.',
            },
        ],
    },
] as const;

export const shortcutGroups = [
    {
        title: 'Góc nhìn',
        shortcuts: [
            { label: 'Xoay góc nhìn', keys: ['Kéo chuột trái'] },
            { label: 'Dịch góc nhìn', keys: ['Kéo chuột phải'] },
            { label: 'Dịch bằng phím', keys: ['Space', 'Kéo chuột'] },
            { label: 'Thu / phóng', keys: ['Cuộn chuột'] },
            { label: 'Đưa đối tượng vào giữa', keys: ['F'] },
        ],
    },
    {
        title: 'Đối tượng',
        shortcuts: [
            { label: 'Chọn nhiều đối tượng', keys: ['Shift', 'Nhấp'] },
            { label: 'Di chuyển', keys: ['W'] },
            { label: 'Xoay', keys: ['E'] },
            { label: 'Đổi kích thước', keys: ['R'] },
            { label: 'Trục thế giới / cục bộ', keys: ['L'] },
            { label: 'Bật / tắt bắt bước', keys: ['N'] },
        ],
    },
    {
        title: 'Chỉnh sửa',
        shortcuts: [
            { label: 'Hoàn tác', keys: ['Ctrl', 'Z'] },
            { label: 'Làm lại', keys: ['Ctrl', 'Shift', 'Z'] },
            { label: 'Nhân bản', keys: ['Ctrl', 'D'] },
            { label: 'Xóa đối tượng', keys: ['Delete'] },
            { label: 'Lưu sách', keys: ['Ctrl', 'S'] },
            { label: 'Hủy kéo hoặc bỏ chọn', keys: ['Esc'] },
        ],
    },
] as const;

export const uploadLimits = [
    { label: 'Hình ảnh', formats: 'JPG, PNG, WebP', size: ASSET_MAX_BYTES.IMAGE / MB },
    {
        label: 'Mô hình 3D',
        formats: 'GLB, GLTF nhúng tài nguyên',
        size: ASSET_MAX_BYTES.MODEL / MB,
    },
    { label: 'Âm thanh', formats: 'MP3, WAV', size: ASSET_MAX_BYTES.AUDIO / MB },
    { label: 'Video', formats: 'MP4', size: ASSET_MAX_BYTES.VIDEO / MB },
];
