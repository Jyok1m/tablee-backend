const dayGenerator = require("generator-virtual-time");
const moment = require("moment");

function toTitleCase(str) {
  return str.toLowerCase().split(" ").map(function (word) {
    return (word.charAt(0).toUpperCase() + word.slice(1));
  }).join(" ");
}

function generateSlots(restaurantName, availabilities) {
  const newArr = [];
  const days = dayGenerator({
    startDate: moment().format("YYYY-MM-DD"),
    endDate: moment().add(1, "years").format("YYYY-MM-DD"),
    title: restaurantName,
    startBlocked: [0, 659],
    middleBlocked: [899, 1079],
    endBlocked: [1319, 1440]
  });
  for (const obj of days) {
    const literalDay = moment(obj.start).locale("fr").format("dddd");
    const upperLiteralDay = toTitleCase(literalDay);
    if (availabilities.includes(literalDay) || availabilities.includes(upperLiteralDay)) newArr.push(obj);
  }
  return newArr;
}

module.exports = {generateSlots};
