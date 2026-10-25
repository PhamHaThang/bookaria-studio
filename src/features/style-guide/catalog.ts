/** Code audit of the current Studio; these are usage notes, not replacement implementations. */
export const auditNotes = [
    {
        group: 'Button',
        status: 'Tên gọi khác nhau',
        finding:
            'Bookaria dùng primary / danger / ghost; primitive dùng default / destructive / outline. Cùng một nguồn style, nhưng ghost của hai lớp khác nhau.',
        recommendation:
            'Màn nghiệp vụ dùng shared/ui/Button. Nút icon, link và công cụ editor dùng primitives/button khi cần thêm biến thể.',
        source: 'shared/ui/Button.tsx → primitives/button.tsx',
    },
    {
        group: 'Phân trang',
        status: 'Còn lặp cách ghép',
        finding:
            'Sách, tài nguyên và khám phá ghép PaginationContent thủ công. Thống kê và Admin dùng Pagination chung; bản chung có thêm icon mũi tên.',
        recommendation:
            'Màn mới dùng shared/ui/Pagination. Khi gom các màn cũ, giữ khóa nút trong lúc đang tải và giữ bộ lọc trên URL.',
        source: 'pages/BooksPage.tsx, AssetsPage.tsx, ExplorePage.tsx; shared/ui/Pagination.tsx',
    },
    {
        group: 'Kích thước control',
        status: 'Còn style cục bộ',
        finding:
            'Ô search đã dùng chung. Một số select trong BooksPage và nút công cụ editor vẫn có chiều cao, cỡ chữ ghi đè ở màn hình.',
        recommendation:
            'Dùng size có sẵn. Giữ bộ công cụ editor nhỏ gọn theo ngữ cảnh; không sao chép style của nó sang form thông thường.',
        source: 'pages/BooksPage.tsx; features/scene/ui/SceneEditor.tsx',
    },
    {
        group: 'Thumbnail tài nguyên',
        status: 'Khác theo ngữ cảnh',
        finding:
            'AssetThumbnail có compact cho hàng danh sách (nền cover, ảnh object-cover) và card cho thư viện (nền trắng, ảnh object-contain). Loading/lỗi lấy theo status của cùng component.',
        recommendation:
            'Dùng đúng variant thay vì tạo component preview mới. Ảnh trong bảng và ảnh trong card có thể khác cách cắt theo chủ đích.',
        source: 'features/assets/ui/AssetThumbnail.tsx',
    },
    {
        group: 'Modal',
        status: 'Khác theo mục đích',
        finding:
            'ConfirmDialog mặc định là Dialog cho nội dung/form; ConfirmationDialog là AlertDialog cho quyết định cần xác nhận. Tên gần nhau dễ gây nhầm.',
        recommendation:
            'Sửa thông tin: Dialog/ConfirmDialog. Xóa hoặc rời bản chưa lưu: ConfirmationDialog. Luôn có tiêu đề và trả focus về nút mở.',
        source: 'shared/ui/ConfirmDialog.tsx; shared/ui/ConfirmationDialog.tsx',
    },
    {
        group: 'Điều hướng và lọc',
        status: 'Khác theo mục đích',
        finding:
            'Tabs đổi vùng nội dung. FilterBar dùng ToggleGroup để lọc dữ liệu. Cả hai có thể có gạch dưới nhưng hành vi bàn phím và ngữ nghĩa khác nhau.',
        recommendation:
            'Đổi panel dùng Tabs; lọc danh sách dùng FilterBar; lựa chọn một/nhiều giá trị dùng RadioGroup/Checkbox/ToggleGroup.',
        source: 'shared/ui/FilterBar.tsx; primitives/tabs.tsx, toggle-group.tsx',
    },
    {
        group: 'Phản hồi và loading',
        status: 'Khác theo ngữ cảnh',
        finding:
            'Feedback thành công dùng toast 4 giây. Lỗi/cảnh báo ở lại trong form. LoadingScreen chờ khung ứng dụng; LoadingState/Skeleton chờ dữ liệu; Spinner chờ thao tác.',
        recommendation:
            'Dùng đúng mức chờ. Tiến độ có số thực dùng Progress; không giả phần trăm. Toast chỉ dùng một Toaster ở gốc ứng dụng.',
        source: 'shared/ui/Feedback.tsx, LoadingScreen.tsx, LoadingState.tsx; primitives/sonner.tsx',
    },
] as const;

export const componentFamilies = [
    [
        'Thương hiệu & tài khoản',
        'BookariaLogo, Avatar',
        'Logo, ảnh tài khoản và fallback dùng chung.',
    ],
    [
        'Thao tác',
        'Button, buttonStyles',
        'Nút nghiệp vụ, liên kết dạng nút, nút icon và trạng thái bận.',
    ],
    [
        'Biểu mẫu',
        'Field, Input, Textarea, SearchInput, PasswordInput, FormSelect',
        'Nhãn, mô tả, lỗi, chỉ đọc và khóa tương tác.',
    ],
    [
        'Lựa chọn',
        'Checkbox, RadioGroup, ToggleGroup',
        'Nhiều lựa chọn, một lựa chọn và nhóm tùy chọn.',
    ],
    [
        'Điều hướng',
        'Tabs, FilterBar, Pagination, Disclosure',
        'Đổi panel, lọc, chuyển trang và mở rộng nội dung.',
    ],
    [
        'Menu & trợ giúp',
        'DropdownMenu, Popover, Tooltip',
        'Menu thao tác, nội dung nổi và chú thích.',
    ],
    [
        'Hộp thoại',
        'Dialog, ConfirmDialog, ConfirmationDialog',
        'Form và xác nhận hành động với focus được quản lý.',
    ],
    [
        'Nội dung',
        'Card, Table, Empty, Badge, AssetThumbnail',
        'Thẻ, bảng, danh sách trống và trạng thái tài nguyên.',
    ],
    ['Phản hồi', 'Alert, Feedback, Sonner, Progress', 'Lỗi tại chỗ, toast và tiến độ xác định.'],
    [
        'Đang tải',
        'LoadingScreen, LoadingState, ContentSkeleton, Spinner',
        'Chờ ứng dụng, dữ liệu trang và tác vụ cục bộ.',
    ],
    [
        'Khung ứng dụng',
        'Sidebar, Sheet, NavigationMenu, ScrollArea, Separator, Chart',
        'Các primitive cho shell, menu công khai, vùng cuộn và biểu đồ thống kê.',
    ],
] as const;
