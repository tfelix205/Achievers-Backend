exports.nameToTitleCase = (string) => {
    if (!string) return '';
    return string
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// exports.desToTitleCase = (string) => {
//     console.log(string.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '));
    
//     if (!string) return '';
//     return string
//         .toLowerCase()
//         .split(' ')
//         .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
//         .join(' ');
// };