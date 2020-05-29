<?php

	echo_html $Options.content;

?>

## Test 1

---

<?php

$test = 1;

if($test){
	echo 'test '.$test;
}else{
	echo 'no test';
}


echo_html '<br><br>';


function test($test){
	if($test & $test != 0){
		echo 'test '.$test;
		return $test;
	}else{
		echo 'no test';
		return false;
	}
	return $test;
}

$test = test(2);

echo_html '<br><br>';

echo $test;

echo_html '<br><br>';

echo 'test 3' | 'test 4';
echo_html '<br>';
echo 'test 3' & false | 'test 4';

?>

<!--todo: replace exiting and entering tags with echo_html functions-->

---

<?php

$obj = {test1: 1, test2: 2};

$objType = typeof($obj);

echo_html $objType.'<br>';

echo $obj.test1.', '.$obj.test2;

echo_html '<br>';

echo $obj;

$html = true;

echo('<br>Hello, World!', $html);

setUserVar('test', 'This is a test');

?>

<hr>

${test} <!--todo: fix test user var not working-->

<br>

{{title}}

<hr>

<?php

each($Opts.list, $item, $index, $from){
	echo_html $from.':<br>';
	echo_html $index.' = '.$item;
	$type = ''.typeof($item);
	//log($type, $type == 'array'); //todo: fix this returning undefined (may need to globally wrap in returning if statement)
	if($type == 'array'){
		echo ' ['.$item[0].', '.$item[1].']';
	}
	echo_html '<br><br>';
}


?>
